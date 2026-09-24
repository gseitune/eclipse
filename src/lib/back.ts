import { prisma } from "./prisma";
import { publishSse } from "./events";
import { computeZoneStandings, type StandingRow } from "./standings";
import {
  computeSchedule,
  DESCENDANT_STAGES,
  type ScheduleMatchInput,
  type ScheduleRow,
} from "./schedule";
import { buildBrackets, selectBestSecond, type BestSecondSelection } from "./brackets";
import { regenerateZones, swapZone, type ZoneId } from "./zonification";
import {
  countSetWins,
  resolveResultPayload,
  type SetFormatId,
  type SetScore,
} from "./result-format";
import type { Stage, Zone } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";

/**
 * SELVARENA backend operations (Prisma layer).
 * The API routes are thin: all product rules live here.
 */

export class BackError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason?: string,
  ) {
    super(message);
  }
}

export async function getState() {
  return prisma.tournamentState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

async function requireUnconfirmed(message: string): Promise<void> {
  const state = await getState();
  if (state.zoneConfirmed) throw new BackError(message, 409);
}

export async function generateZones(): Promise<Record<string, string>> {
  await requireUnconfirmed(
    "Zonification is confirmed: re-arming is forbidden after fixture generation.",
  );
  const teams = await prisma.team.findMany({ select: { id: true } });
  if (teams.length < 6) {
    throw new BackError("Need at least 6 teams to arm zones.", 400);
  }
  const mapping = regenerateZones(teams.map((t) => t.id));
  await prisma.$transaction(
    teams.map((t) =>
      prisma.team.update({
        where: { id: t.id },
        data: { zone: mapping[t.id] as "A" | "B" | "C" },
      }),
    ),
  );
  publishSse("zones-changed", { mapping });
  return mapping;
}

export async function swapTeam(
  teamId: string,
  from: string,
  to: string,
): Promise<Record<string, string>> {
  await requireUnconfirmed(
    "Zonification is confirmed: manual swaps are forbidden after fixture generation.",
  );
  const state = await getState();
  const teams = await prisma.team.findMany({ select: { id: true, zone: true } });
  const mapping = Object.fromEntries(
    teams.map((t) => [t.id, t.zone]),
  ) as Record<string, ZoneId>;
  const validZones = new Set<ZoneId>(["A", "B", "C"]);
  if (!validZones.has(from as ZoneId) || !validZones.has(to as ZoneId)) {
    throw new BackError("Invalid zone.", 400);
  }
  const next = swapZone(mapping, teamId, from as ZoneId, to as ZoneId, state.zoneConfirmed);
  await prisma.team.update({ where: { id: teamId }, data: { zone: next[teamId] as "A" | "B" | "C" } });
  publishSse("zones-changed", { swap: { teamId, from, to } });
  return next;
}

export async function confirmZonification(): Promise<{ zoneConfirmed: boolean }> {
  const state = await prisma.tournamentState.update({
    where: { id: 1 },
    data: { zoneConfirmed: true },
  });
  publishSse("zoning-confirmed", { zoneConfirmed: true });
  return { zoneConfirmed: state.zoneConfirmed };
}

export async function getTeamsByZone() {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  const byZone: Record<string, typeof teams> = { A: [], B: [], C: [] };
  for (const t of teams) byZone[t.zone].push(t);
  return byZone;
}

export async function getStandings(): Promise<Partial<Record<string, StandingRow[]>>> {
  const [teams, matches] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, zone: true } }),
    prisma.match.findMany({
      select: {
        stage: true,
        zone: true,
        teamAId: true,
        teamBId: true,
        sets: true,
        resultStatus: true,
        winnerId: true,
      },
    }),
  ]);
  const standings: Partial<Record<string, StandingRow[]>> = {};
  for (const zone of ["A", "B", "C"] as const) {
    const rows = computeZoneStandings(
      teams,
      matches.map((m) => {
        const sets = (m.sets ?? null) as SetScore[] | null;
        const wins = sets ? countSetWins(sets) : { a: null, b: null };
        return {
          stage: m.stage,
          zone: m.zone,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          setAScore: wins.a,
          setBScore: wins.b,
          resultStatus: m.resultStatus,
          winnerId: m.winnerId,
        };
      }),
      zone,
    );
    if (rows.length > 0) standings[zone] = rows;
  }
  return standings;
}

export async function getSchedule(): Promise<ScheduleRow[]> {
  const [state, matches] = await Promise.all([
    getState(),
    prisma.match.findMany({
      select: {
        id: true,
        slot: true,
        stage: true,
        timeLabel: true,
        sets: true,
        setFormat: true,
        resultStatus: true,
        recordedAt: true,
      },
    }),
  ]);
  const input: ScheduleMatchInput[] = matches.map((m) => ({
    id: m.id,
    slot: m.slot,
    stage: m.stage,
    timeLabel: m.timeLabel,
    sets: (m.sets ?? null) as SetScore[] | null,
    setFormat: m.setFormat,
    resultStatus: m.resultStatus,
    recordedAt: m.recordedAt,
  }));
  return computeSchedule(input, state.prepMinutes, state.matchMinutes);
}

export async function getNextMatch() {
  return prisma.match.findFirst({
    where: {
      resultStatus: "PENDING",
      teamAId: { not: null },
      teamBId: { not: null },
    },
    orderBy: { slot: "asc" },
    include: { teamA: true, teamB: true },
  });
}

/** Fills the semifinal slots and flips the phase; refuses while a tie keeps the second open. */
async function finalizeBrackets(
  standings: Partial<Record<Zone, StandingRow[]>>,
  resolvedSecondId?: string,
): Promise<{ ok: boolean; missing: string[] }> {
  const { pairings, missing } = buildBrackets(standings, {
    ...(resolvedSecondId ? { resolvedSecondId } : {}),
  });
  if (missing.length > 0 || pairings.length === 0) {
    publishSse("brackets-blocked", { missing });
    return { ok: false, missing };
  }
  for (const pairing of pairings) {
    await prisma.match.updateMany({
      where: { stage: pairing.stage },
      data: { teamAId: pairing.teamAId, teamBId: pairing.teamBId },
    });
  }
  await prisma.tournamentState.update({
    where: { id: 1 },
    data: { phase: "ELIMINATORIES" },
  });
  publishSse("phase-changed", { phase: "ELIMINATORIES" });
  publishSse("brackets-generated", { pairings });
  return { ok: true, missing: [] };
}

/**
 * Creates the DESEMPATE match for the best-second spot (3-zone format).
 * The match enters the schedule chain between the last group match and the
 * eliminatories; existing bracket slots shift one slot later to make room.
 */
async function createDesempateMatch(selection: {
  teamAId: string;
  teamBId: string;
}): Promise<boolean> {
  const existing = await prisma.match.findFirst({
    where: { stage: "DESEMPATE", resultStatus: "PENDING" },
  });
  if (existing) return false;

  const state = await getState();
  if (state.phase !== "GROUPS") return false;

  const maxGroupSlot = await prisma.match.aggregate({
    _max: { slot: true },
    where: { stage: "GROUPS" },
  });
  const anchor = maxGroupSlot._max.slot ?? 0;

  // Make room: push every slot after the groups one position later.
  await prisma.match.updateMany({
    where: { slot: { gt: anchor } },
    data: { slot: { increment: 1 } },
  });

  const desempate = await prisma.match.create({
    data: {
      stage: "DESEMPATE",
      slot: anchor + 1,
      timeLabel: null,
      teamAId: selection.teamAId,
      teamBId: selection.teamBId,
    },
  });

  await prisma.tournamentState.update({
    where: { id: 1 },
    data: { phase: "DESEMPATE" },
  });

  publishSse("desempate-created", {
    matchId: desempate.id,
    teamAId: selection.teamAId,
    teamBId: selection.teamBId,
  });
  publishSse("phase-changed", { phase: "DESEMPATE" });
  publishSse("schedule-changed", { matchId: desempate.id });
  return true;
}

export async function getBracketsSnapshot() {
  return prisma.match.findMany({
    where: { stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2", "FINAL"] } },
    orderBy: { slot: "asc" },
    include: { teamA: true, teamB: true, winner: true },
  });
}

/**
 * Full public snapshot for GET /api/state.
 * Exposes phase (GROUPS | DESEMPATE | ELIMINATORIES), the standings already
 * ordered by the tiebreak criterion, and — when applicable — the DESEMPATE
 * flag + assigned match, plus the 3+ seconds blocked edge as a report.
 */
export async function getStateSnapshot() {
  const [state, standings, schedule, brackets, nextMatch, zones, desempateMatches] =
    await Promise.all([
      getState(),
      getStandings(),
      getSchedule(),
      getBracketsSnapshot(),
      getNextMatch(),
      getTeamsByZone(),
      prisma.match.findMany({
        where: { stage: "DESEMPATE" },
        include: { teamA: true, teamB: true },
        orderBy: { slot: "asc" },
      }),
    ]);

  const zonesPresent = Object.keys(standings) as Zone[];
  let selection: BestSecondSelection | null = null;
  if (state.phase !== "ELIMINATORIES" && zonesPresent.length === 3) {
    selection = selectBestSecond(standings);
  }

  const pendingDesempate =
    desempateMatches.find((m) => m.resultStatus === "PENDING") ?? null;

  const desempate = {
    needed:
      state.phase === "DESEMPATE" ||
      pendingDesempate !== null ||
      selection?.kind === "playoff",
    pending: pendingDesempate !== null,
    match: pendingDesempate
      ? {
          id: pendingDesempate.id,
          slot: pendingDesempate.slot,
          teamA: pendingDesempate.teamA
            ? {
                id: pendingDesempate.teamA.id,
                name: pendingDesempate.teamA.name,
              }
            : null,
          teamB: pendingDesempate.teamB
            ? {
                id: pendingDesempate.teamB.id,
                name: pendingDesempate.teamB.name,
              }
            : null,
        }
      : null,
  };

  const bracketsBlocked =
    selection?.kind === "blocked"
      ? { reason: "three_seconds_tie", teamIds: selection.teamIds }
      : null;

  return {
    phase: state.phase,
    zoneConfirmed: state.zoneConfirmed,
    prepMinutes: state.prepMinutes,
    matchMinutes: state.matchMinutes,
    standings,
    schedule,
    brackets,
    nextMatch,
    zones,
    desempate,
    bracketsBlocked,
  };
}

export interface RecordResultInput {
  matchId: string;
  setFormat?: SetFormatId | null;
  sets?: SetScore[] | null;
  winnerId?: string | null;
}

/**
 * Shared result payload for record and edit: a full multi-set score (the
 * winner is derived from the sets, WINNER_ONLY stays legal everywhere) OR an
 * explicit winner — never a partial result, and the optional winnerId must
 * agree with the score when both are present. All format rules (win-by-2,
 * per-stage formats, set counts) live in result-format.ts.
 */

interface ReconcileOutcome {
  phaseChanged: boolean;
  bracketsChanged: boolean;
  desempateCreated: boolean;
}

/**
 * Re-runs the phase/bracket machinery after a result landed (record or edit):
 * standings are always re-read, so positions and the estimate chain stay fresh;
 * the GROUPS/DESEMPATE transitions only fire when the phase allows it.
 * `allowBracketRebuild` lets an edit rebuild already-generated semis from the
 * new standings — something a fresh result never needs (it only finalizes once).
 */
async function reconcileAfterMatch(
  stage: string,
  winnerId: string | null,
  allowBracketRebuild: boolean,
): Promise<ReconcileOutcome> {
  let phaseChanged = false;
  let bracketsChanged = false;
  let desempateCreated = false;

  if (stage === "GROUPS") {
    const groupExpected = await prisma.match.count({
      where: { stage: "GROUPS" },
    });
    const groupDecided = await prisma.match.count({
      where: { stage: "GROUPS", resultStatus: { not: "PENDING" } },
    });

    if (groupDecided === groupExpected) {
      const state = await getState();
      const mayFinalize =
        state.phase === "GROUPS" ||
        (state.phase === "ELIMINATORIES" && allowBracketRebuild);
      if (mayFinalize) {
        const standings = await getStandings();
        const zones = Object.keys(standings) as Zone[];
        if (zones.length === 3) {
          const selection = selectBestSecond(standings);
          if (selection?.kind === "playoff") {
            if (state.phase === "GROUPS") {
              desempateCreated = await createDesempateMatch(selection);
            } else {
              // Rebuild after an edit would need a fresh desempate: report it.
              publishSse("brackets-blocked", {
                reason: "needs_desempate",
                teamAId: selection.teamAId,
                teamBId: selection.teamBId,
              });
            }
          } else if (selection?.kind === "blocked") {
            publishSse("brackets-blocked", {
              reason: "three_seconds_tie",
              teamIds: selection.teamIds,
            });
          } else {
            const res = await finalizeBrackets(standings);
            phaseChanged = res.ok;
            bracketsChanged = res.ok;
          }
        } else {
          const res = await finalizeBrackets(standings);
          phaseChanged = res.ok;
          bracketsChanged = res.ok;
        }
      }
    }
  } else if (stage === "DESEMPATE" && winnerId) {
    const state = await getState();
    if (state.phase === "DESEMPATE") {
      const standings = await getStandings();
      const res = await finalizeBrackets(standings, winnerId);
      phaseChanged = res.ok;
      bracketsChanged = res.ok;
    }
  }

  return { phaseChanged, bracketsChanged, desempateCreated };
}

export async function recordResult(input: RecordResultInput) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: { teamA: true, teamB: true },
  });
  if (!match) throw new BackError("Match not found.", 404);
  if (match.resultStatus !== "PENDING") {
    throw new BackError("Match already has a result.", 409);
  }
  if (!match.teamAId || !match.teamBId) {
    throw new BackError("Bracket slot has no teams yet.", 409);
  }

  const payload = resolveResultPayload(
    match.teamAId,
    match.teamBId,
    match.stage,
    input,
  );

  await prisma.match.update({
    where: { id: match.id },
    data: {
      // Prisma Json fields reject interface-shaped arrays (index signature),
      // so the validated value is cast at the write boundary.
      sets: payload.sets
        ? (payload.sets as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      setFormat: payload.setFormat,
      resultStatus: payload.resultStatus,
      winnerId: payload.winnerId,
      recordedAt: new Date(),
    },
  });

  publishSse("result-recorded", { matchId: match.id, phase: null });

  const outcome = await reconcileAfterMatch(match.stage, payload.winnerId, false);

  publishSse("standings-changed", { matchId: match.id });
  publishSse("schedule-changed", { matchId: match.id });

  return {
    matchId: match.id,
    ...outcome,
    nextMatch: await getNextMatch(),
  };
}

/** EditResultInput is the same payload surface as recordResult. */
export type EditResultInput = RecordResultInput;

/**
 * Re-records the result of an already-played match (fixing a bad quick-capture
 * from the phone). Same payload validation as recordResult. Guards:
 * - nothing to edit when the match has no result (409 no_result_to_edit);
 * - a played descendant phase closes the match: editing would invalidate the
 *   bracket (409 editing_blocks_bracket).
 * Zone confirmation does NOT block editing.
 */
export async function editResult(input: EditResultInput) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: { teamA: true, teamB: true },
  });
  if (!match) throw new BackError("Match not found.", 404);
  if (match.resultStatus === "PENDING") {
    throw new BackError(
      "Nothing to edit: the match has no result yet.",
      409,
      "no_result_to_edit",
    );
  }

  // Structural guard first: a blocked edit returns its reason regardless of
  // the payload shape (validation errors never mask the bracket rule).
  const descendants = DESCENDANT_STAGES[match.stage] ?? [];
  if (descendants.length > 0) {
    const played = await prisma.match.count({
      where: {
        stage: { in: [...descendants] as Stage[] },
        resultStatus: { not: "PENDING" },
      },
    });
    if (played > 0) {
      throw new BackError(
        "Cannot edit: a descendant phase already has a result — editing would invalidate the bracket.",
        409,
        "editing_blocks_bracket",
      );
    }
  }

  if (!match.teamAId || !match.teamBId) {
    throw new BackError("Bracket slot has no teams yet.", 409);
  }

  const payload = resolveResultPayload(
    match.teamAId,
    match.teamBId,
    match.stage,
    input,
  );

  await prisma.match.update({
    where: { id: match.id },
    data: {
      sets: payload.sets
        ? (payload.sets as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      setFormat: payload.setFormat,
      resultStatus: payload.resultStatus,
      winnerId: payload.winnerId,
      recordedAt: new Date(),
    },
  });

  publishSse("result-recorded", { matchId: match.id, phase: null });

  const outcome = await reconcileAfterMatch(match.stage, payload.winnerId, true);

  publishSse("standings-changed", { matchId: match.id });
  publishSse("schedule-changed", { matchId: match.id });

  return {
    matchId: match.id,
    ...outcome,
    nextMatch: await getNextMatch(),
  };
}
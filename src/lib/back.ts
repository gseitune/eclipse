import { prisma } from "./prisma";
import { publishSse } from "./events";
import { computeZoneStandings, type StandingRow } from "./standings";
import {
  computeSchedule,
  DESCENDANT_STAGES,
  type ScheduleMatchInput,
  type ScheduleRow,
} from "./schedule";
import { buildBrackets, nextRoundPairings, selectBestSecond, type BestSecondSelection } from "./brackets";
import { regenerateZones, swapZone, type ZoneId } from "./zonification";
import { distributeTeams, MIN_TEAMS, roundRobinPairs } from "./tournament";
import {
  countSetWins,
  resolveResultPayload,
  type SetFormatId,
  type SetScore,
} from "./result-format";
import type { Stage, Zone, SetFormat } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";

/**
 * SELVARENA backend operations (Prisma layer).
 * The API routes are thin: all product rules live here.
 *
 * Etapas: every entity belongs to an Etapa (circuit stage). Back operations
 * that read/write tournament data accept an optional `etapaId` — when omitted
 * they resolve to the LATEST etapa (the active one). Result record/edit derive
 * the etapa from the match itself.
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

/** Resolves the requested etapa, defaulting to the latest when omitted. */
export async function resolveEtapaId(etapaId?: string | null): Promise<string> {
  if (etapaId) {
    const etapa = await prisma.etapa.findUnique({
      where: { id: etapaId },
      select: { id: true },
    });
    if (!etapa) throw new BackError("Etapa not found.", 404, "unknown_etapa");
    return etapa.id;
  }
  const latest = await prisma.etapa.findFirst({
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!latest) throw new BackError("No etapas yet.", 404, "no_etapas");
  return latest.id;
}

export interface EtapaMeta {
  id: string;
  name: string;
  date: string | null;
  sortOrder: number;
  teamCount: number;
  closedAt: string | null;
}

export async function listEtapas(): Promise<EtapaMeta[]> {
  const etapas = await prisma.etapa.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      date: true,
      sortOrder: true,
      closedAt: true,
      _count: { select: { teams: true } },
    },
  });
  return etapas.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date ? e.date.toISOString() : null,
    sortOrder: e.sortOrder,
    teamCount: e._count.teams,
    closedAt: e.closedAt ? e.closedAt.toISOString() : null,
  }));
}

export interface CreateTeamInput {
  name: string;
  maleName: string;
  femaleName: string;
}

export interface CreateEtapaInput {
  name: string;
  date?: string | null;
  teams: CreateTeamInput[];
  bracketFormat?: "STANDARD" | "REPECHAJE";
}

/** MAX teams per etapa: 12 keeps the one-day single-court fixture sane. */
export const MAX_TEAMS_PER_ETAPA = 12;

/** MIN teams per etapa: 6 required for 2 zones. */
export const MIN_TEAMS_PER_ETAPA = 6;

/**
 * Creates a full etapa: the Etapa row, its teams (names split into zones),
 * the group round-robin fixture and the bracket slots, plus its tournament
 * state. The new etapa becomes the latest (active) one. Teams are capped at
 * MAX_TEAMS_PER_ETAPA and zone sizes follow tournament.ts rules.
 *
 * Mixto fijo: every team must carry exactly one male and one female player
 * name — the per-sex individual ranking depends on them.
 */
export async function createEtapa(input: CreateEtapaInput, _opts?: { rng?: () => number }) {
  const name = input.name.trim();
  if (!name) throw new BackError("Etapa name is required.", 400, "name_required");
  if (name.length > 120) {
    throw new BackError("Etapa name is too long.", 400, "name_too_long");
  }

  const uniqueTeams = new Map<string, CreateTeamInput>();
  for (const rawTeam of input.teams ?? []) {
    const teamName = typeof rawTeam?.name === "string" ? rawTeam.name.trim() : "";
    const maleName = typeof rawTeam?.maleName === "string" ? rawTeam.maleName.trim() : "";
    const femaleName = typeof rawTeam?.femaleName === "string" ? rawTeam.femaleName.trim() : "";
    if (!teamName) continue;
    if (!maleName || !femaleName) {
      throw new BackError(
        `Team "${teamName}" needs both players: mixto fijo requires one male and one female name.`,
        400,
        "team_players_required",
      );
    }
    if (!uniqueTeams.has(teamName)) {
      uniqueTeams.set(teamName, { name: teamName, maleName, femaleName });
    }
  }

  const teamNames = [...uniqueTeams.keys()];
  if (teamNames.length < MIN_TEAMS) {
    throw new BackError(
      `Etapa needs at least 6 teams, got ${teamNames.length}.`,
      400,
      "too_few_teams",
    );
  }
  if (teamNames.length > MAX_TEAMS_PER_ETAPA) {
    throw new BackError(
      `Etapa supports at most ${MAX_TEAMS_PER_ETAPA} teams, got ${teamNames.length}.`,
      400,
      "too_many_teams",
    );
  }
  if (teamNames.some((t) => t.length > 60)) {
    throw new BackError("Team names must be 60 characters or fewer.", 400, "name_too_long");
  }
  for (const t of uniqueTeams.values()) {
    if (t.maleName.length > 60 || t.femaleName.length > 60) {
      throw new BackError(
        "Player names must be 60 characters or fewer.",
        400,
        "name_too_long",
      );
    }
  }

  let date: Date | null = null;
  if (input.date) {
    const parsed = new Date(input.date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BackError("Invalid etapa date.", 400, "invalid_date");
    }
    date = parsed;
  }

  const groups = distributeTeams(teamNames);
  const bracketFormat = input.bracketFormat ?? "STANDARD" as "STANDARD" | "REPECHAJE";
  // Validate REPECHAJE: requires exactly 2 zones and <= 10 teams.
  if (bracketFormat === "REPECHAJE") {
    const zoneCount = groups.length;
    if (zoneCount !== 2) {
      throw new BackError(
        `REPECHAJE requires exactly 2 zones, got ${zoneCount}.`,
        400,
        "repechaje_two_zones_only",
      );
    }
  }

  const isRepechaje = bracketFormat === "REPECHAJE";

  const etapa = await prisma.$transaction(async (tx) => {
    const created = await tx.etapa.create({
      data: {
        name,
        date,
        sortOrder: (await tx.etapa.count()) + 1,
        bracketFormat: bracketFormat as import("../generated/prisma/client").BracketFormat,
        state: { create: {} },
        teams: {
          create: groups.flatMap((group) =>
            group.teams.map((teamName) => {
              const team = uniqueTeams.get(teamName) as CreateTeamInput;
              return {
                name: teamName,
                zone: group.group,
                maleName: team.maleName,
                femaleName: team.femaleName,
              };
            }),
          ),
        },
      },
      include: { teams: true },
    });

    const idByName = new Map(created.teams.map((t) => [t.name, t.id]));
    let slot = 1;
    const groupMatches = groups.flatMap((group) => {
      const ids = group.teams.map((t) => idByName.get(t) as string);
      return roundRobinPairs(ids).map(([teamAId, teamBId]) => ({
        etapaId: created.id,
        stage: "GROUPS" as Stage,
        zone: group.group,
        slot: slot++,
        timeLabel: null,
        teamAId,
        teamBId,
        setFormat: "SINGLE_21" as SetFormat,
        resultStatus: "PENDING" as const,
      }));
    });
    const bracketSlots = isRepechaje
      ? [
          { stage: "REPECHAJE_1" as Stage, slot: slot++ },
          { stage: "REPECHAJE_2" as Stage, slot: slot++ },
          { stage: "SEMIFINAL_1" as Stage, slot: slot++ },
          { stage: "SEMIFINAL_2" as Stage, slot: slot++ },
          { stage: "BRONZE" as Stage, slot: slot++ },
          { stage: "FINAL" as Stage, slot: slot++ },
        ]
      : [
          { stage: "SEMIFINAL_1" as Stage, slot: slot++ },
          { stage: "SEMIFINAL_2" as Stage, slot: slot++ },
          { stage: "FINAL" as Stage, slot: slot++ },
        ];
    const bracketSlotData = bracketSlots.map((m) => ({
      etapaId: created.id,
      stage: m.stage,
      zone: null,
      slot: m.slot,
      timeLabel: null,
      teamAId: null,
      teamBId: null,
      setFormat: null as SetFormat | null,
      resultStatus: "PENDING" as const,
    }));

    await tx.match.createMany({ data: [...groupMatches, ...bracketSlotData] });

    return created;
  });

  publishSse("etapa-created", {
    etapaId: etapa.id,
    name: etapa.name,
    teamCount: etapa.teams.length,
  });

  // Real fixture size: intra-zone round-robin pairs + bracket slots.
  const bracketSlotCount = isRepechaje ? 6 : 3;
  const groupMatchCount = groups.reduce(
    (acc, g) => acc + (g.teams.length * (g.teams.length - 1)) / 2,
    0,
  );

  return {
    id: etapa.id,
    name: etapa.name,
    date: etapa.date ? etapa.date.toISOString() : null,
    sortOrder: etapa.sortOrder,
    teamCount: etapa.teams.length,
    matchCount: groupMatchCount + bracketSlotCount,
  };
}

export async function getState(etapaId?: string | null) {
  const id = await resolveEtapaId(etapaId);
  return prisma.tournamentState.upsert({
    where: { etapaId: id },
    update: {},
    create: { etapaId: id },
  });
}

async function requireUnconfirmed(message: string, etapaId?: string | null): Promise<void> {
  const state = await getState(etapaId);
  if (state.zoneConfirmed) throw new BackError(message, 409);
}

/** Reads the Etapa row and throws 409 when closedAt is set. */
async function requireEtapaOpen(etapaId: string): Promise<void> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { closedAt: true },
  });
  if (etapa && etapa.closedAt) {
    throw new BackError(
      "Circuito cerrado: la etapa ya no admite modificaciones.",
      409,
      "etapa_cerrada",
    );
  }
}

export async function generateZones(etapaId?: string | null): Promise<Record<string, string>> {
  const id = await resolveEtapaId(etapaId);
  await requireEtapaOpen(id);
  await requireUnconfirmed(
    "Zonification is confirmed: re-arming is forbidden after fixture generation.",
    etapaId,
  );
  const teams = await prisma.team.findMany({ where: { etapaId: id }, select: { id: true } });
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
  etapaId?: string | null,
): Promise<Record<string, string>> {
  const id = await resolveEtapaId(etapaId);
  await requireEtapaOpen(id);
  await requireUnconfirmed(
    "Zonification is confirmed: manual swaps are forbidden after fixture generation.",
    etapaId,
  );
  const state = await getState(id);
  const teams = await prisma.team.findMany({
    where: { etapaId: id },
    select: { id: true, zone: true },
  });
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

export async function confirmZonification(etapaId?: string | null): Promise<{ zoneConfirmed: boolean }> {
  const id = await resolveEtapaId(etapaId);
  await requireEtapaOpen(id);
  const state = await getState(id);
  await prisma.tournamentState.update({
    where: { id: state.id },
    data: { zoneConfirmed: true },
  });
  publishSse("zoning-confirmed", { zoneConfirmed: true });
  return { zoneConfirmed: true };
}

export async function getTeamsByZone(etapaId?: string | null) {
  const id = await resolveEtapaId(etapaId);
  const teams = await prisma.team.findMany({
    where: { etapaId: id },
    orderBy: { name: "asc" },
  });
  const byZone: Record<string, typeof teams> = { A: [], B: [], C: [] };
  for (const t of teams) byZone[t.zone].push(t);
  return byZone;
}

export async function getStandings(etapaId?: string | null): Promise<Partial<Record<string, StandingRow[]>>> {
  const id = await resolveEtapaId(etapaId);
  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      where: { etapaId: id },
      select: { id: true, name: true, zone: true, maleName: true, femaleName: true },
    }),
    prisma.match.findMany({
      where: { etapaId: id },
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

export async function getSchedule(etapaId?: string | null): Promise<ScheduleRow[]> {
  const id = await resolveEtapaId(etapaId);
  const [state, matches] = await Promise.all([
    getState(id),
    prisma.match.findMany({
      where: { etapaId: id },
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
      orderBy: { slot: "asc" },
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

export async function getNextMatch(etapaId?: string | null) {
  const id = await resolveEtapaId(etapaId);
  return prisma.match.findFirst({
    where: {
      etapaId: id,
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
  etapaId: string,
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
      where: { stage: pairing.stage as Stage, etapaId },
      data: { teamAId: pairing.teamAId, teamBId: pairing.teamBId },
    });
  }
  const state = await getState(etapaId);
  await prisma.tournamentState.update({
    where: { id: state.id },
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
}, etapaId: string): Promise<boolean> {
  const existing = await prisma.match.findFirst({
    where: { etapaId, stage: "DESEMPATE", resultStatus: "PENDING" },
  });
  if (existing) return false;

  const state = await getState(etapaId);
  if (state.phase !== "GROUPS") return false;

  const maxGroupSlot = await prisma.match.aggregate({
    _max: { slot: true },
    where: { etapaId, stage: "GROUPS" },
  });
  const anchor = maxGroupSlot._max.slot ?? 0;

  // Make room: push every slot after the groups one position later.
  await prisma.match.updateMany({
    where: { etapaId, slot: { gt: anchor } },
    data: { slot: { increment: 1 } },
  });

  const desempate = await prisma.match.create({
    data: {
      etapaId,
      stage: "DESEMPATE",
      slot: anchor + 1,
      timeLabel: null,
      teamAId: selection.teamAId,
      teamBId: selection.teamBId,
    },
  });

  await prisma.tournamentState.update({
    where: { id: state.id },
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

export async function getBracketsSnapshot(etapaId?: string | null) {
  const id = await resolveEtapaId(etapaId);
  return prisma.match.findMany({
    where: { etapaId: id, stage: { in: ["REPECHAJE_1", "REPECHAJE_2", "SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"] } },
    orderBy: { slot: "asc" },
    include: { teamA: true, teamB: true, winner: true },
  });
}

/**
 * Full public snapshot for GET /api/state.
 * Exposes phase (GROUPS | DESEMPATE | ELIMINATORIES), the standings already
 * ordered by the tiebreak criterion, and — when applicable — the DESEMPATE
 * flag + assigned match, plus the 3+ seconds blocked edge as a report.
 * Also carries the etapa meta + the full etapa list for the public selector.
 */
export async function getStateSnapshot(etapaId?: string | null) {
  const id = await resolveEtapaId(etapaId);
  const [state, standings, schedule, brackets, nextMatch, zones, desempateMatches, etapas] =
    await Promise.all([
      getState(id),
      getStandings(id),
      getSchedule(id),
      getBracketsSnapshot(id),
      getNextMatch(id),
      getTeamsByZone(id),
      prisma.match.findMany({
        where: { etapaId: id, stage: "DESEMPATE" },
        include: { teamA: true, teamB: true },
        orderBy: { slot: "asc" },
      }),
      listEtapas(),
    ]);
  const etapa = etapas.find((e) => e.id === id) ?? null;

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
    etapaId: id,
    etapa,
    etapas,
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
 * Fills descendant bracket slots when a feeder match records a result.
 * - REPECHAJE_1 result → fill SEMIFINAL_2 (1°B vs winner RE1)
 * - REPECHAJE_2 result → fill SEMIFINAL_1 (1°A vs winner RE2)
 * - Both semis have winners → fill FINAL (winners) AND BRONZE (losers)
 *
 * Returns true if any slot was updated.
 */
async function fillDescendantMatches(
  etapaId: string,
  stage: string,
  __winnerId: string | null,
): Promise<boolean> {
  const updated = await prisma.$transaction(async (tx) => {
    let changed = false;

    if (stage === "REPECHAJE_1" || stage === "REPECHAJE_2") {
      // Determine which semi to fill and who plays whom.
      // Need 1°A and 1°B from standings.
      const standings = await getStandings(etapaId);
      const a1Id = standings.A?.[0]?.teamId ?? null;
      const b1Id = standings.B?.[0]?.teamId ?? null;
      if (!a1Id || !b1Id) return false;

      // Read all existing bracket match results to determine current state.
      const allMatches = await prisma.match.findMany({
        where: { etapaId, stage: { in: ["REPECHAJE_1", "REPECHAJE_2", "SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"] as Stage[] } },
        select: { stage: true, teamAId: true, teamBId: true, winnerId: true, resultStatus: true },
      });
      const completed: Record<string, string | null> = {};
      for (const m of allMatches) {
        if (m.resultStatus !== "PENDING" && m.winnerId) {
          completed[m.stage] = m.winnerId;
        }
      }

      const pairings = nextRoundPairings(standings, completed);
      for (const p of pairings) {
        // Only fill if the slot still has null teams (not yet filled).
        const existing = await tx.match.findFirst({
          where: { etapaId, stage: p.stage as Stage, teamAId: null, teamBId: null },
        });
        if (existing) {
          await tx.match.update({
            where: { id: existing.id },
            data: { teamAId: p.teamAId, teamBId: p.teamBId },
          });
          changed = true;
        }
      }
    } else if (stage === "SEMIFINAL_1" || stage === "SEMIFINAL_2") {
      // Both semis need winners to fill FINAL and BRONZE.
      const allMatches = await prisma.match.findMany({
        where: { etapaId, stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2"] as Stage[] } },
        select: { stage: true, teamAId: true, teamBId: true, winnerId: true, resultStatus: true },
      });
      const winners: Record<string, string | null> = {};
      for (const m of allMatches) {
        if (m.resultStatus !== "PENDING") winners[m.stage] = m.winnerId;
      }
      if (winners["SEMIFINAL_1"] && winners["SEMIFINAL_2"]) {
        const w1 = winners["SEMIFINAL_1"]!;
        const w2 = winners["SEMIFINAL_2"]!;
        // FINAL = winners
        const finalSlot = await tx.match.findFirst({
          where: { etapaId, stage: "FINAL" as Stage, teamAId: null, teamBId: null },
        });
        if (finalSlot) {
          await tx.match.update({
            where: { id: finalSlot.id },
            data: { teamAId: w1, teamBId: w2 },
          });
          changed = true;
        }
        // BRONZE = losers
        const semi1Match = allMatches.find((m) => m.stage === "SEMIFINAL_1");
        const semi2Match = allMatches.find((m) => m.stage === "SEMIFINAL_2");
        const loser1 = w1 === semi1Match?.teamAId ? semi1Match.teamBId : semi1Match?.teamAId;
        const loser2 = w2 === semi2Match?.teamAId ? semi2Match.teamBId : semi2Match?.teamAId;
        const bronzeSlot = await tx.match.findFirst({
          where: { etapaId, stage: "BRONZE" as Stage, teamAId: null, teamBId: null },
        });
        if (bronzeSlot && loser1 && loser2) {
          await tx.match.update({
            where: { id: bronzeSlot.id },
            data: { teamAId: loser1, teamBId: loser2 },
          });
          changed = true;
        }
      }
    }

    return changed;
  });
  return updated;
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
  etapaId: string,
): Promise<ReconcileOutcome> {
  let phaseChanged = false;
  let bracketsChanged = false;
  let desempateCreated = false;

  if (stage === "GROUPS") {
    const groupExpected = await prisma.match.count({
      where: { etapaId, stage: "GROUPS" },
    });
    const groupDecided = await prisma.match.count({
      where: { etapaId, stage: "GROUPS", resultStatus: { not: "PENDING" } },
    });

    if (groupDecided === groupExpected) {
      const state = await getState(etapaId);
      const mayFinalize =
        state.phase === "GROUPS" ||
        (state.phase === "ELIMINATORIES" && allowBracketRebuild);
      if (mayFinalize) {
        const standings = await getStandings(etapaId);
        const zones = Object.keys(standings) as Zone[];
        if (zones.length === 3) {
          const selection = selectBestSecond(standings);
          if (selection?.kind === "playoff") {
            if (state.phase === "GROUPS") {
              desempateCreated = await createDesempateMatch(selection, etapaId);
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
            const res = await finalizeBrackets(standings, etapaId);
            phaseChanged = res.ok;
            bracketsChanged = res.ok;
          }
        } else {
          const res = await finalizeBrackets(standings, etapaId);
          phaseChanged = res.ok;
          bracketsChanged = res.ok;
        }
      }
    }
  } else if (stage === "DESEMPATE" && winnerId) {
    const state = await getState(etapaId);
    if (state.phase === "DESEMPATE") {
      const standings = await getStandings(etapaId);
      const res = await finalizeBrackets(standings, etapaId, winnerId);
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

  await requireEtapaOpen(match.etapaId);

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

  const outcome = await reconcileAfterMatch(match.stage, payload.winnerId, false, match.etapaId);

  // Fill descendant bracket slots when a feeder match records a result.
  await fillDescendantMatches(match.etapaId, match.stage, payload.winnerId);

  publishSse("standings-changed", { matchId: match.id });
  publishSse("schedule-changed", { matchId: match.id });

  return {
    matchId: match.id,
    ...outcome,
    nextMatch: await getNextMatch(match.etapaId),
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
        etapaId: match.etapaId,
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

  await requireEtapaOpen(match.etapaId);

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

  const outcome = await reconcileAfterMatch(match.stage, payload.winnerId, true, match.etapaId);

  // Fill descendant bracket slots when a feeder match records a result.
  await fillDescendantMatches(match.etapaId, match.stage, payload.winnerId);

  publishSse("standings-changed", { matchId: match.id });
  publishSse("schedule-changed", { matchId: match.id });

  return {
    matchId: match.id,
    ...outcome,
    nextMatch: await getNextMatch(match.etapaId),
  };
}
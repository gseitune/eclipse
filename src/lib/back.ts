import { prisma } from "./prisma";
import { publishSse } from "./events";
import { computeZoneStandings, type StandingRow } from "./standings";
import {
  CASCADE_ALL_ELIM,
  CASCADE_CLEAR_STAGES,
  CASCADE_NULL_TEAMS,
  computeSchedule,
  DESCENDANT_STAGES,
  type ScheduleMatchInput,
  type ScheduleRow,
} from "./schedule";
import { buildBrackets, buildCuartosBrackets, nextRoundPairings, selectBestSecond, selectBestThird, type BestSecondSelection, type BestThirdSelection } from "./brackets";
import { regenerateZones, swapZone, type ZoneId } from "./zonification";
import { distributeTeams, interleaveGroupPairs, MIN_TEAMS } from "./tournament";
import {
  countSetPoints,
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
  cancelledAt: string | null;
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
       cancelledAt: true,
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
     cancelledAt: e.cancelledAt ? e.cancelledAt.toISOString() : null,
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
  bracketFormat?: "STANDARD" | "REPECHAJE" | "CUARTOS";
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

  const groups = distributeTeams(teamNames, _opts?.rng);
  const bracketFormat = input.bracketFormat ?? "STANDARD" as "STANDARD" | "REPECHAJE" | "CUARTOS";
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
  // Validate CUARTOS: requires exactly 3 zones and 11–12 teams.
  if (bracketFormat === "CUARTOS") {
    const zoneCount = groups.length;
    if (zoneCount !== 3) {
      throw new BackError(
        `CUARTOS requires exactly 3 zones, got ${zoneCount}.`,
        400,
        "cuartos_three_zones_only",
      );
    }
    if (teamNames.length < 11 || teamNames.length > 12) {
      throw new BackError(
        `CUARTOS requires 11-12 teams, got ${teamNames.length}.`,
        400,
        "cuartos_team_count",
      );
    }
  }

  const isRepechaje = bracketFormat === "REPECHAJE";
  const isCuartos = bracketFormat === "CUARTOS";

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
    // Single court: rotate zones one match at a time (A, B, C, A, B, C, …) so
    // players rest between matches instead of playing a whole zone back-to-back.
    const groupMatches = interleaveGroupPairs(
      groups.map((group) => ({
        group: group.group,
        teamIds: group.teams.map((t) => idByName.get(t) as string),
      })),
    ).map(({ group, teamAId, teamBId }) => ({
      etapaId: created.id,
      stage: "GROUPS" as Stage,
      zone: group,
      slot: slot++,
      timeLabel: null,
      teamAId,
      teamBId,
      setFormat: "SINGLE_21" as SetFormat,
      resultStatus: "PENDING" as const,
    }));
    const bracketSlots = isRepechaje
      ? [
          { stage: "REPECHAJE_1" as Stage, slot: slot++ },
          { stage: "REPECHAJE_2" as Stage, slot: slot++ },
          { stage: "SEMIFINAL_1" as Stage, slot: slot++ },
          { stage: "SEMIFINAL_2" as Stage, slot: slot++ },
          { stage: "BRONZE" as Stage, slot: slot++ },
          { stage: "FINAL" as Stage, slot: slot++ },
        ]
      : isCuartos
      ? [
           { stage: "REPECHAJE_1" as Stage, slot: slot++ },
           { stage: "CUARTOS_1" as Stage, slot: slot++ },
           { stage: "CUARTOS_2" as Stage, slot: slot++ },
           { stage: "CUARTOS_3" as Stage, slot: slot++ },
           { stage: "CUARTOS_4" as Stage, slot: slot++ },
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
  const bracketSlotCount = isRepechaje ? 6 : isCuartos ? 9 : 3;
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

/** Reads the Etapa row and throws 409 when closedAt or cancelledAt is set. */
async function requireEtapaOpen(etapaId: string): Promise<void> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { closedAt: true, cancelledAt: true },
  });
  if (etapa?.cancelledAt) {
    throw new BackError(
      "Etapa cancelada: la etapa ya no admite modificaciones.",
      409,
      "etapa_cancelled",
    );
  }
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
        const points = sets ? countSetPoints(sets) : { a: null, b: null };
        return {
          stage: m.stage,
          zone: m.zone,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          setAScore: wins.a,
          setBScore: wins.b,
          pointsA: points.a,
          pointsB: points.b,
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

export interface ScheduleBoardRow {
  id: string;
  slot: number;
  stage: string;
  zone: string | null;
  scheduled: string | null;
  estimated: string | null;
  estimatedFromResult: boolean;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
  resultStatus: string;
  editable: boolean;
  manualStartAt?: string | null;
  manualEndAt?: string | null;
}

export async function getScheduleBoard(etapaId?: string | null): Promise<ScheduleBoardRow[]> {
  const id = await resolveEtapaId(etapaId);
  const [state, matches] = await Promise.all([
    getState(id),
    prisma.match.findMany({
      where: { etapaId: id },
      include: { teamA: { select: { id: true, name: true } }, teamB: { select: { id: true, name: true } } },
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
    manualStartAt: m.manualStartAt?.toISOString() ?? null,
    manualEndAt: m.manualEndAt?.toISOString() ?? null,
  }));

  const rows = computeSchedule(input, state.prepMinutes, state.matchMinutes);

  const matchMap = new Map(matches.map((m) => [m.id, m]));

  return rows.map((row) => {
    const match = matchMap.get(row.id)!;
    return {
      ...row,
      zone: match.zone,
      teamA: match.teamA ? { id: match.teamA.id, name: match.teamA.name } : null,
      teamB: match.teamB ? { id: match.teamB.id, name: match.teamB.name } : null,
      resultStatus: match.resultStatus,
      editable: row.editable,
      manualStartAt: row.manualStartAt,
      manualEndAt: row.manualEndAt,
    };
  });
}

/**
 * Reorder a match within an etapa by swapping its slot with the nearest
 * PENDING neighbor in the given direction ("up" = lower slot, "down" = higher slot).
 * Only PENDING matches can be moved. Uses a transaction to swap two slots.
 */
export async function reorderMatch(matchId: string, direction: "up" | "down"): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, slot: true, stage: true, resultStatus: true, etapaId: true },
  });

  if (!match) {
    throw new BackError("Match not found.", 404, "match_not_found");
  }

  if (match.resultStatus !== "PENDING") {
    throw new BackError("Only PENDING matches can be reordered.", 409, "match_not_pending");
  }

  const id = match.etapaId;
  await requireEtapaOpen(id);

  const allMatches = await prisma.match.findMany({
    where: { etapaId: id },
    select: { id: true, slot: true, resultStatus: true },
    orderBy: { slot: "asc" },
  });

  const currentIndex = allMatches.findIndex((m) => m.id === matchId);
  if (currentIndex === -1) {
    throw new BackError("Match not found in this etapa.", 404, "match_not_found");
  }

  let swapIndex = -1;

  if (direction === "up") {
    // Find nearest PENDING neighbor with lower slot
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (allMatches[i].resultStatus === "PENDING") {
        swapIndex = i;
        break;
      }
    }
  } else {
    // Find nearest PENDING neighbor with higher slot
    for (let i = currentIndex + 1; i < allMatches.length; i++) {
      if (allMatches[i].resultStatus === "PENDING") {
        swapIndex = i;
        break;
      }
    }
  }

  if (swapIndex === -1) {
    throw new BackError(
      direction === "up"
        ? "No pending match with a lower slot to swap with."
        : "No pending match with a higher slot to swap with.",
      409,
      direction === "up" ? "no_pending_neighbor_up" : "no_pending_neighbor_down",
    );
  }

  const matchToSwap = allMatches[swapIndex];

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { slot: matchToSwap.slot },
    });
    await tx.match.update({
      where: { id: matchToSwap.id },
      data: { slot: match.slot },
    });
  });

  publishSse("schedule-changed", { matchId });
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
        manualStartAt: true,
        manualEndAt: true,
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
    manualStartAt: m.manualStartAt?.toISOString() ?? null,
    manualEndAt: m.manualEndAt?.toISOString() ?? null,
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
  format?: "STANDARD" | "REPECHAJE" | "CUARTOS",
  resolvedThirdId?: string,
): Promise<{ ok: boolean; missing: string[] }> {
  const { pairings, missing } = buildBrackets(standings, {
    ...(resolvedSecondId ? { resolvedSecondId } : {}),
    ...(resolvedThirdId ? { resolvedThirdId } : {}),
    format,
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
    where: { etapaId: id, stage: { in: ["REPECHAJE_1", "REPECHAJE_2", "SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL", "CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"] } },
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
  // Heal any bracket hole before reading it, so a stuck tournament resumes on a
  // plain refresh instead of needing a reset. Idempotent and fill-only.
  const phaseRow = await prisma.tournamentState.findUnique({
    where: { etapaId: id },
    select: { phase: true },
  });
  if (phaseRow?.phase === "ELIMINATORIES") await reconcileEliminatories(id);
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
  const etapaRecord = await prisma.etapa.findUnique({
    where: { id: id },
    select: { bracketFormat: true },
  });
  const fmt = etapaRecord?.bracketFormat;

  const zonesPresent = Object.keys(standings) as Zone[];
  let bestThirdSelection: BestThirdSelection | null = null;
  let bestSecondSelection: BestSecondSelection | null = null;
  if (state.phase !== "ELIMINATORIES" && zonesPresent.length === 3) {
    if (fmt === "CUARTOS") {
      bestThirdSelection = selectBestThird(standings);
    } else {
      bestSecondSelection = selectBestSecond(standings);
    }
  }

  const pendingDesempate =
    desempateMatches.find((m) => m.resultStatus === "PENDING") ?? null;

  const desempate = {
    needed:
      state.phase === "DESEMPATE" ||
      pendingDesempate !== null ||
      bestSecondSelection?.kind === "playoff",
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
    bestThirdSelection?.kind === "blocked"
      ? { reason: bestThirdSelection.reason, teamIds: bestThirdSelection.teamIds }
      : bestSecondSelection?.kind === "blocked"
      ? { reason: "three_seconds_tie", teamIds: bestSecondSelection.teamIds }
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
 * - CUARTOS REPECHAJE_1 result → fill CUARTOS_1 (A1 vs RE1 winner)
 * - CUARTOS_1..4 results → when all 4 QFs done, fill SEMIFINAL_1/2 (QF1vQF4, QF2vQF3)
 * - REPECHAJE_1 → fill SEMIFINAL_2 (1°B vs winner RE1) [REPECHAJE format]
 * - REPECHAJE_2 → fill SEMIFINAL_1 (1°A vs winner RE2) [REPECHAJE format]
 * - Both semis → fill FINAL and BRONZE
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

    const etapa = await prisma.etapa.findUnique({
      where: { id: etapaId },
      select: { bracketFormat: true },
    });
    const fmt = etapa?.bracketFormat ?? "STANDARD";

    if (fmt === "CUARTOS" && stage === "REPECHAJE_1") {
      // Any non-PENDING status counts: a WINNER_ONLY quick-capture also knows the
      // winner, and CUARTOS_1 stays unplayable until that side is filled.
      const re1Match = await tx.match.findFirst({
        where: {
          etapaId,
          stage: "REPECHAJE_1" as Stage,
          resultStatus: { not: "PENDING" },
        },
      });
      const re1Winner = re1Match?.winnerId ?? null;
      if (!re1Match || !re1Winner) return false;

      // Seeding 1v8: the RE1 winner is seed 8 and lands in CUARTOS_1 next to A1
      // (seed 1). The best 3rd (seed 7) is already placed in CUARTOS_2 by
      // finalizeBrackets, so only CUARTOS_1's open side is filled here.
      const cuartos1 = await tx.match.findFirst({
        where: { etapaId, stage: "CUARTOS_1" as Stage },
      });
      if (!cuartos1) return false;

      // Prefer the open B side (seed 8 sits next to seed 1) and fall back to A
      // only when B is taken, so the same team is never written into both sides.
      const updateData: Record<string, string | null> = {};
      if (cuartos1.teamBId === null) updateData.teamBId = re1Winner;
      else if (cuartos1.teamAId === null) updateData.teamAId = re1Winner;
      if (Object.keys(updateData).length > 0) {
        await tx.match.update({ where: { id: cuartos1.id }, data: updateData });
        changed = true;
      }
    } else if (stage === "REPECHAJE_1" || stage === "REPECHAJE_2") {
      const standings = await getStandings(etapaId);
      const a1Id = standings.A?.[0]?.teamId ?? null;
      const b1Id = standings.B?.[0]?.teamId ?? null;
      if (!a1Id || !b1Id) return false;

      const allMatches = await prisma.match.findMany({
        where: { etapaId, stage: { in: ["REPECHAJE_1", "REPECHAJE_2", "SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL", "CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"] as Stage[] } },
        select: { stage: true, teamAId: true, teamBId: true, winnerId: true, resultStatus: true },
      });
      const completed: Record<string, string | null> = {};
      for (const m of allMatches) {
        if (m.resultStatus !== "PENDING" && m.winnerId) {
          completed[m.stage] = m.winnerId;
        }
      }

      const pairings = nextRoundPairings(standings, completed, fmt as "STANDARD" | "REPECHAJE" | "CUARTOS");
      for (const p of pairings) {
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
    } else if (fmt === "CUARTOS" && stage.startsWith("CUARTOS_")) {
      const allQfMatches = await prisma.match.findMany({
        where: { etapaId, stage: { in: ["CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"] as Stage[] } },
        select: { stage: true, winnerId: true, resultStatus: true },
      });
      const qfWinners: Record<string, string | null> = {};
      for (const m of allQfMatches) {
        if (m.resultStatus !== "PENDING" && m.winnerId) qfWinners[m.stage] = m.winnerId;
      }
      const allQfDone = ["CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"].every(
        (s) => qfWinners[s],
      );
      const semi1Match = await tx.match.findFirst({
        where: { etapaId, stage: "SEMIFINAL_1" as Stage, teamAId: null, teamBId: null },
      });
      const semi2Match = await tx.match.findFirst({
        where: { etapaId, stage: "SEMIFINAL_2" as Stage, teamAId: null, teamBId: null },
      });

      if (allQfDone && semi1Match && semi2Match) {
        const q1w = qfWinners["CUARTOS_1"]!;
        const q2w = qfWinners["CUARTOS_2"]!;
        const q3w = qfWinners["CUARTOS_3"]!;
        const q4w = qfWinners["CUARTOS_4"]!;
        const pairings = getCuartosSemifinalPairingsFromBack(q1w, q2w, q3w, q4w);
        for (const p of pairings) {
          const targetMatch = p.stage === "SEMIFINAL_1" ? semi1Match : semi2Match;
          if (targetMatch) {
            await tx.match.update({
              where: { id: targetMatch.id },
              data: { teamAId: p.teamAId, teamBId: p.teamBId },
            });
            changed = true;
          }
        }
      }
    }

    return changed;
  });
  return updated;
}

/**
 * Self-healing pass over the eliminatories: replays every derivation in
 * bracket order from the results already recorded. It only fills slots that are
 * still empty — it never rewrites a recorded result and never clears anything —
 * so it is safe to run on every state read.
 *
 * Derivations used to be a pure write-time side effect, so a hole left behind
 * (a build that lacked the rule, or a partial failure) froze the tournament
 * with no way back short of a reset. With this pass, a refresh heals it.
 */
export async function reconcileEliminatories(etapaId: string): Promise<boolean> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { bracketFormat: true },
  });
  if (!etapa) return false;

  const byFormat: Record<string, Stage[]> = {
    CUARTOS: [
      "REPECHAJE_1",
      "CUARTOS_1",
      "CUARTOS_2",
      "CUARTOS_3",
      "CUARTOS_4",
      "SEMIFINAL_1",
      "SEMIFINAL_2",
    ],
    REPECHAJE: ["REPECHAJE_1", "REPECHAJE_2", "SEMIFINAL_1", "SEMIFINAL_2"],
    STANDARD: ["SEMIFINAL_1", "SEMIFINAL_2"],
  };
  const stages = byFormat[etapa.bracketFormat] ?? byFormat.STANDARD;

  let changed = false;
  for (const stage of stages) {
    if (await fillDescendantMatches(etapaId, stage, null)) changed = true;
  }
  return changed;
}

/**
 * CUARTOS semifinal pairings — fixed bracket, no same-zone avoidance.
 *
 * Seeding 1v8/2v7/3v6/4v5: SEMIFINAL_1 = QF1 winner vs QF4 winner,
 * SEMIFINAL_2 = QF2 winner vs QF3 winner. This is Andi's real bracket, which
 * pairs two zone-B winners in SEMIFINAL_2 (RG vs LM), so no avoidance is applied.
 */
function getCuartosSemifinalPairingsFromBack(
  q1w: string, q2w: string, q3w: string, q4w: string,
): Array<{ stage: string; teamAId: string; teamBId: string }> {
  return [
    { stage: "SEMIFINAL_1", teamAId: q1w, teamBId: q4w },
    { stage: "SEMIFINAL_2", teamAId: q2w, teamBId: q3w },
  ];
}

/**
 * Organizer picks the best third when the automatic selection ties.
 *
 * Andi's points rule compares each third ONLY against its own zone's top 2
 * (wins -> point diff -> points for). The three thirds can tie to the end of
 * the chain, and the engine refuses to invent a tiebreaker. The organizer
 * names the winner; the repechage is then filled with the other two thirds.
 * Only a team that is actually in the tie is accepted.
 */
export async function resolveBestThird(
  etapaId: string,
  teamId: string,
): Promise<{ ok: boolean; missing: string[] }> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { bracketFormat: true },
  });
  if (etapa?.bracketFormat !== "CUARTOS") {
    throw new BackError(
      "Best third can only be resolved in the CUARTOS format.",
      400,
      "not_cuartos_format",
    );
  }

  const standings = await getStandings(etapaId);
  const selection = selectBestThird(standings);
  if (
    selection?.kind !== "blocked" ||
    selection.reason !== "best_third_tie" ||
    !selection.teamIds.includes(teamId)
  ) {
    throw new BackError(
      "That team is not tied for best third.",
      400,
      "team_not_tied_for_best_third",
    );
  }

  // The organizer already chose the desempate path: the pending match owns the
  // tie now, and a draw pick on top of it would leave a dangling DESEMPATE.
  const pendingDesempate = await prisma.match.findFirst({
    where: { etapaId, stage: "DESEMPATE", resultStatus: "PENDING" },
  });
  if (pendingDesempate) {
    throw new BackError(
      "A desempate match is already pending; record its result instead.",
      409,
      "desempate_already_pending",
    );
  }

  return finalizeBrackets(standings, etapaId, undefined, "CUARTOS", teamId);
}

/**
 * Organizer picks the "Desempate" path for a tied best third (CUARTOS).
 *
 * Only valid with exactly two tied thirds: the 1v1 desempate does not apply to
 * three (there the draw — resolveBestThird — is the only path). Creates the
 * DESEMPATE match between the two; when its result lands, reconcileAfterMatch
 * routes the winner into CUARTOS_2 (seed 7 vs B1) and the loser into REPECHAJE_1
 * against the remaining third, then finalizes the bracket.
 */
export async function createBestThirdDesempate(
  etapaId: string,
): Promise<{ ok: boolean }> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { bracketFormat: true },
  });
  if (etapa?.bracketFormat !== "CUARTOS") {
    throw new BackError(
      "Best third desempate is only available in the CUARTOS format.",
      400,
      "not_cuartos_format",
    );
  }

  const state = await getState(etapaId);
  if (state.phase !== "GROUPS") {
    throw new BackError(
      "The desempate can only be created while the group phase is open.",
      409,
      "phase_not_groups",
    );
  }

  const standings = await getStandings(etapaId);
  const selection = selectBestThird(standings);
  if (
    selection?.kind !== "blocked" ||
    selection.reason !== "best_third_tie" ||
    selection.teamIds.length !== 2
  ) {
    throw new BackError(
      "The desempate needs exactly two tied thirds; use the draw otherwise.",
      409,
      "best_third_desempate_requires_two",
    );
  }

  const created = await createDesempateMatch(
    {
      teamAId: selection.teamIds[0] as string,
      teamBId: selection.teamIds[1] as string,
    },
    etapaId,
  );
  if (!created) {
    throw new BackError(
      "A desempate is already pending or the group phase is over.",
      409,
      "desempate_unavailable",
    );
  }
  return { ok: true };
}

/**
 * Re-assigns the GROUPS slots of an existing etapa to the interleaved rotation
 * (A, B, C, A, B, C, …) that freshly created etapas use, so no team plays two
 * group matches back-to-back. Only the group slots move; pairs, results and
 * bracket slots stay untouched. Refused once any group match has a result, and
 * off the group phase — this re-fits a fixture that never rotated, not a live one.
 */
export async function reslotGroupSchedule(
  etapaId: string,
): Promise<{ moved: number; total: number }> {
  const state = await getState(etapaId);
  if (state.phase !== "GROUPS") {
    throw new BackError(
      "The rotation can only be re-applied before the eliminatories.",
      409,
      "phase_not_groups",
    );
  }

  const groupMatches = await prisma.match.findMany({
    where: { etapaId, stage: "GROUPS" },
    orderBy: { slot: "asc" },
    select: { id: true, zone: true, slot: true, resultStatus: true },
  });
  if (groupMatches.length === 0) {
    throw new BackError(
      "The etapa has no group matches.",
      409,
      "no_group_matches",
    );
  }
  if (groupMatches.some((m) => m.resultStatus !== "PENDING")) {
    throw new BackError(
      "There are played group matches; re-apply the rotation before recording results.",
      409,
      "groups_already_played",
    );
  }

  // Per-zone queues in their current slot order already match the round-robin
  // order createEtapa used, so interleaving by index reproduces the rotation.
  const queues = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (m.zone === null) continue;
    const key = String(m.zone);
    const bucket = queues.get(key);
    if (bucket) bucket.push(m);
    else queues.set(key, [m]);
  }
  const zones = [...queues.keys()].sort();

  const plan: { id: string; newSlot: number }[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const z of zones) {
      const next = queues.get(z)!.shift();
      if (next) {
        plan.push({ id: next.id, newSlot: plan.length + 1 });
        progressed = true;
      }
    }
  }

  const oldSlotById = new Map(groupMatches.map((m) => [m.id, m.slot]));
  const moved = plan.filter((p) => oldSlotById.get(p.id) !== p.newSlot).length;
  if (moved > 0) {
    await prisma.$transaction(
      plan.map((p) =>
        prisma.match.update({ where: { id: p.id }, data: { slot: p.newSlot } }),
      ),
    );
    publishSse("schedule-changed", {});
  }
  return { moved, total: plan.length };
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
        const etapa = await prisma.etapa.findUnique({
          where: { id: etapaId },
          select: { bracketFormat: true },
        });
        const fmt = etapa?.bracketFormat;
        if (zones.length === 3) {
          if (fmt === "CUARTOS") {
            const selection = selectBestThird(standings);
            if (selection?.kind === "blocked") {
              publishSse("brackets-blocked", {
                reason: selection.reason,
                teamIds: selection.teamIds,
              });
            } else {
              const res = await finalizeBrackets(standings, etapaId, undefined, "CUARTOS");
              phaseChanged = res.ok;
              bracketsChanged = res.ok;
            }
          } else {
            const selection = selectBestSecond(standings);
            if (selection?.kind === "playoff") {
              if (state.phase === "GROUPS") {
                desempateCreated = await createDesempateMatch(selection, etapaId);
              } else {
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
      const etapa = await prisma.etapa.findUnique({
        where: { id: etapaId },
        select: { bracketFormat: true },
      });
      // CUARTOS: the desempate resolves the best THIRD (it advances to
      // CUARTOS_2 as seed 7), not the best second. Route it through
      // resolvedThirdId so the winner is not injected as a second-place team on
      // a format that has no second-place slot.
      const res =
        etapa?.bracketFormat === "CUARTOS"
          ? await finalizeBrackets(standings, etapaId, undefined, "CUARTOS", winnerId)
          : await finalizeBrackets(standings, etapaId, winnerId);
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

/**
 * EditResultInput is the same payload surface as recordResult, plus an
 * optional cascade flag. cascade: true lets the organizer correct a match
 * whose descendants already have results: the invalidated chain is cleared
 * inside the same transaction as the edit, so a failure can never leave a
 * half-cleared bracket.
 */
export type EditResultInput = RecordResultInput & { cascade?: boolean };

/**
 * Clears the dependent results/teams a correction invalidates, inside the
 * same transaction as the edit. Only called when cascade was requested AND a
 * descendant already had a result. Runs BEFORE the edited match is updated so
 * the new result and the cleared chain commit atomically.
 */
async function clearCascadeResults(
  tx: Prisma.TransactionClient,
  etapaId: string,
  stage: string,
  oldWinnerId: string | null,
): Promise<void> {
  const clearStages = CASCADE_CLEAR_STAGES[stage] ?? [];
  if (clearStages.length > 0) {
    await tx.match.updateMany({
      where: {
        etapaId,
        stage: { in: [...clearStages] as Stage[] },
        resultStatus: { not: "PENDING" },
      },
      data: {
        resultStatus: "PENDING",
        sets: Prisma.DbNull,
        setFormat: null,
        winnerId: null,
        recordedAt: null,
      },
    });
  }

  const nullStages = CASCADE_NULL_TEAMS[stage] ?? [];
  if (nullStages.length > 0) {
    await tx.match.updateMany({
      where: { etapaId, stage: { in: [...nullStages] as Stage[] } },
      data: { teamAId: null, teamBId: null },
    });
  }

  // REPECHAJE_1 feeds CUARTOS_1's open side (seed 8 next to seed 1). Only
  // the side holding the old winner is cleared; the seeded side must survive
  // so the fill can write the new winner into the empty side.
  if (stage === "REPECHAJE_1") {
    const cuartos1 = await tx.match.findFirst({
      where: { etapaId, stage: "CUARTOS_1" as Stage },
    });
    if (cuartos1) {
      const side =
        cuartos1.teamBId === oldWinnerId
          ? "teamBId"
          : cuartos1.teamAId === oldWinnerId
            ? "teamAId"
            : "teamBId";
      await tx.match.update({
        where: { id: cuartos1.id },
        data: { [side]: null },
      });
    }
  }
}

/**
 * Re-records the result of an already-played match (fixing a bad quick-capture
 * from the phone). Same payload validation as recordResult. Guards:
 * - nothing to edit when the match has no result (409 no_result_to_edit);
 * - a played descendant phase closes the match: editing would invalidate the
 *   bracket (409 editing_blocks_bracket). With cascade: true the organizer can
 *   correct it anyway: the invalidated chain is cleared atomically with the
 *   edit, descendant bracket slots are emptied, and the fill logic re-derives
 *   the bracket from the new result.
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
  let playedDescendants = 0;
  if (descendants.length > 0) {
    playedDescendants = await prisma.match.count({
      where: {
        etapaId: match.etapaId,
        stage: { in: [...descendants] as Stage[] },
        resultStatus: { not: "PENDING" },
      },
    });
    if (playedDescendants > 0 && !input.cascade) {
      throw new BackError(
        "Cannot edit: a descendant phase already has a result — editing would invalidate the bracket. Pass cascade: true to clear the invalidated chain and re-enter those results.",
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

  const updateData = {
    sets: payload.sets
      ? (payload.sets as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
    setFormat: payload.setFormat,
    resultStatus: payload.resultStatus,
    winnerId: payload.winnerId,
    recordedAt: new Date(),
  };

  if (playedDescendants > 0 && input.cascade) {
    // Cascade correction: clear the invalidated chain INSIDE the same
    // transaction as the edit. reconcileAfterMatch and fillDescendantMatches
    // below then re-derive the bracket from the corrected result.
    await prisma.$transaction(async (tx) => {
      await clearCascadeResults(tx, match.etapaId, match.stage, match.winnerId);
      await tx.match.update({ where: { id: match.id }, data: updateData });
    });
  } else {
    await prisma.match.update({ where: { id: match.id }, data: updateData });
  }

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
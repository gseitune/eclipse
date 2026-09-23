import { prisma } from "./prisma";
import { publishSse } from "./events";
import { computeZoneStandings, type StandingRow } from "./standings";
import { computeSchedule, type ScheduleRow } from "./schedule";
import { buildBrackets } from "./brackets";
import { regenerateZones, swapZone, type ZoneId } from "./zonification";

/**
 * SELVARENA backend operations (Prisma layer).
 * The API routes are thin: all product rules live here.
 */

export class BackError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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
        setAScore: true,
        setBScore: true,
        resultStatus: true,
        winnerId: true,
      },
    }),
  ]);
  const standings: Partial<Record<string, StandingRow[]>> = {};
  for (const zone of ["A", "B", "C"] as const) {
    const rows = computeZoneStandings(teams, matches, zone);
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
        resultStatus: true,
        recordedAt: true,
      },
    }),
  ]);
  return computeSchedule(matches, state.prepMinutes, state.matchMinutes);
}

export async function getNextMatch() {
  return prisma.match.findFirst({
    where: { resultStatus: "PENDING" },
    orderBy: { slot: "asc" },
    include: { teamA: true, teamB: true },
  });
}

export async function getBracketsSnapshot() {
  return prisma.match.findMany({
    where: { stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2", "FINAL"] } },
    orderBy: { slot: "asc" },
    include: { teamA: true, teamB: true, winner: true },
  });
}

export interface RecordResultInput {
  matchId: string;
  setAScore?: number | null;
  setBScore?: number | null;
  winnerId?: string | null;
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

  const hasSets =
    input.setAScore !== null &&
    input.setAScore !== undefined &&
    input.setBScore !== null &&
    input.setBScore !== undefined;

  let resultStatus: "COMPLETE" | "WINNER_ONLY";
  let winnerId: string | null;
  let setAScore: number | null = null;
  let setBScore: number | null = null;

  if (hasSets) {
    const a = input.setAScore!;
    const b = input.setBScore!;
    if (a <= 0 || b <= 0) {
      throw new BackError("Sets must be positive.", 400);
    }
    if (a === b) throw new BackError("Sets cannot tie.", 400);
    resultStatus = "COMPLETE";
    winnerId = a > b ? match.teamAId : match.teamBId;
    setAScore = a;
    setBScore = b;
    if (input.winnerId && input.winnerId !== winnerId) {
      throw new BackError("winnerId does not match the set scores.", 400);
    }
  } else if (input.winnerId) {
    if (input.winnerId !== match.teamAId && input.winnerId !== match.teamBId) {
      throw new BackError("winnerId must be one of the playing teams.", 400);
    }
    resultStatus = "WINNER_ONLY";
    winnerId = input.winnerId;
  } else {
    throw new BackError(
      "Provide a full score or an explicit winner — never a partial result.",
      400,
    );
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      setAScore,
      setBScore,
      resultStatus,
      winnerId,
      recordedAt: new Date(),
    },
  });

  publishSse("result-recorded", { matchId: match.id, phase: null });

  let phaseChanged = false;
  let bracketsChanged = false;
  const groupExpected = await prisma.match.count({
    where: { stage: "GROUPS" },
  });
  const groupDecided = await prisma.match.count({
    where: { stage: "GROUPS", resultStatus: { not: "PENDING" } },
  });

  if (groupDecided === groupExpected) {
    const state = await getState();
    if (state.phase === "GROUPS") {
      const standings = await getStandings();
      const { pairings, missing } = buildBrackets(standings);
      if (missing.length > 0) {
        publishSse("brackets-blocked", { missing });
      } else {
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
        phaseChanged = true;
        bracketsChanged = true;
        publishSse("phase-changed", { phase: "ELIMINATORIES" });
        publishSse("brackets-generated", { pairings });
      }
    }
  }

  publishSse("standings-changed", { matchId: match.id });
  publishSse("schedule-changed", { matchId: match.id });

  return {
    matchId: match.id,
    phaseChanged,
    bracketsChanged,
    nextMatch: await getNextMatch(),
  };
}
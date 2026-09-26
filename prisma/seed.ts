/**
 * Etapa 5 seed — CANONICAL LOADED DATA from the brief + official plantilla:
 * - 10 teams split into Zona A / Zona B (fixed by the brief).
 * - 23 matches: 20 group-phase (fixed pairs + times, single court),
 *   semifinals (A1 vs B2, B1 vs A2) and the final.
 * - ALL results are loaded (COMPLETE with SINGLE_21 sets, except the matches
 *   whose score the brief omits — those are WINNER_ONLY with the official
 *   winner): group 16:20 "Sil y Lucas 21 — Mati y Cin ?" and the eliminatorias
 *   (semifinals from the plantilla dropdown: Lu y Gus / Vivi y Santy; final
 *   Lu y Gus). Zone pairs: A1 Lu y Gus, A2 Alex y Flor, B1 Vivi y Santy,
 *   B2 Mati y Cin (consistent with the loaded results).
 * - The stage ends ELIMINATORIES with zoneConfirmed, because the etapa is
 *   finished and every result is in.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

type Zone = "A" | "B";
type Stage =
  | "GROUPS"
  | "SEMIFINAL_1"
  | "SEMIFINAL_2"
  | "FINAL";

interface TeamRow {
  name: string;
  zone: Zone;
}

interface MatchRow {
  time: string;
  stage: Stage;
  zone?: Zone;
  teamA?: string;
  teamB?: string;
  /** Full SINGLE_21 score [teamA, teamB]; omitted for WINNER_ONLY. */
  sets?: [number, number];
  /** Official winner. For WINNER_ONLY entries the score is not in the brief. */
  winner?: string;
}

const TEAMS: TeamRow[] = [
  { name: "Lu y Gus", zone: "A" },
  { name: "Alex y Flor", zone: "A" },
  { name: "Gon y Belén", zone: "A" },
  { name: "Gabi y Nabi", zone: "A" },
  { name: "Liz y Sebita", zone: "A" },
  { name: "Vivi y Santy", zone: "B" },
  { name: "Mati y Cin", zone: "B" },
  { name: "Roxi y Dany", zone: "B" },
  { name: "Enzo y Kari", zone: "B" },
  { name: "Sil y Lucas", zone: "B" },
];

const MATCHES: MatchRow[] = [
  { time: "10:00 - 10:20", stage: "GROUPS", zone: "A", teamA: "Lu y Gus", teamB: "Alex y Flor", sets: [21, 17], winner: "Lu y Gus" },
  { time: "10:20 - 10:40", stage: "GROUPS", zone: "B", teamA: "Vivi y Santy", teamB: "Mati y Cin", sets: [21, 10], winner: "Vivi y Santy" },
  { time: "10:40 - 11:00", stage: "GROUPS", zone: "A", teamA: "Gon y Belén", teamB: "Gabi y Nabi", sets: [21, 19], winner: "Gon y Belén" },
  { time: "11:00 - 11:20", stage: "GROUPS", zone: "B", teamA: "Roxi y Dany", teamB: "Enzo y Kari", sets: [21, 17], winner: "Roxi y Dany" },
  { time: "11:20 - 11:40", stage: "GROUPS", zone: "A", teamA: "Liz y Sebita", teamB: "Lu y Gus", sets: [18, 21], winner: "Lu y Gus" },
  { time: "11:40 - 12:00", stage: "GROUPS", zone: "B", teamA: "Sil y Lucas", teamB: "Vivi y Santy", sets: [5, 21], winner: "Vivi y Santy" },
  { time: "12:00 - 12:20", stage: "GROUPS", zone: "A", teamA: "Alex y Flor", teamB: "Gon y Belén", sets: [21, 11], winner: "Alex y Flor" },
  { time: "12:20 - 12:40", stage: "GROUPS", zone: "B", teamA: "Mati y Cin", teamB: "Roxi y Dany", sets: [21, 12], winner: "Mati y Cin" },
  { time: "12:40 - 13:00", stage: "GROUPS", zone: "A", teamA: "Gabi y Nabi", teamB: "Liz y Sebita", sets: [15, 21], winner: "Liz y Sebita" },
  { time: "13:00 - 13:20", stage: "GROUPS", zone: "B", teamA: "Enzo y Kari", teamB: "Sil y Lucas", sets: [21, 11], winner: "Enzo y Kari" },
  { time: "13:20 - 13:40", stage: "GROUPS", zone: "A", teamA: "Lu y Gus", teamB: "Gon y Belén", sets: [21, 13], winner: "Lu y Gus" },
  { time: "13:40 - 14:00", stage: "GROUPS", zone: "B", teamA: "Vivi y Santy", teamB: "Roxi y Dany", sets: [21, 12], winner: "Vivi y Santy" },
  { time: "14:00 - 14:20", stage: "GROUPS", zone: "A", teamA: "Alex y Flor", teamB: "Gabi y Nabi", sets: [21, 4], winner: "Alex y Flor" },
  { time: "14:20 - 14:40", stage: "GROUPS", zone: "B", teamA: "Mati y Cin", teamB: "Enzo y Kari", sets: [21, 17], winner: "Mati y Cin" },
  { time: "14:40 - 15:00", stage: "GROUPS", zone: "A", teamA: "Gon y Belén", teamB: "Liz y Sebita", sets: [21, 9], winner: "Gon y Belén" },
  { time: "15:00 - 15:20", stage: "GROUPS", zone: "B", teamA: "Roxi y Dany", teamB: "Sil y Lucas", sets: [21, 14], winner: "Roxi y Dany" },
  { time: "15:20 - 15:40", stage: "GROUPS", zone: "A", teamA: "Gabi y Nabi", teamB: "Lu y Gus", sets: [5, 21], winner: "Lu y Gus" },
  { time: "15:40 - 16:00", stage: "GROUPS", zone: "B", teamA: "Enzo y Kari", teamB: "Vivi y Santy", sets: [11, 21], winner: "Vivi y Santy" },
  { time: "16:00 - 16:20", stage: "GROUPS", zone: "A", teamA: "Liz y Sebita", teamB: "Alex y Flor", sets: [12, 21], winner: "Alex y Flor" },
  // 16:20 — the brief shows "21 v" with no second score: WINNER_ONLY Sil y Lucas.
  { time: "16:20 - 16:40", stage: "GROUPS", zone: "B", teamA: "Sil y Lucas", teamB: "Mati y Cin", winner: "Sil y Lucas" },
  // Eliminatorias — winners from the plantilla dropdown; scores not in the brief.
  { time: "16:40 - 17:00", stage: "SEMIFINAL_1", teamA: "Lu y Gus", teamB: "Mati y Cin", winner: "Lu y Gus" },
  { time: "17:00 - 17:20", stage: "SEMIFINAL_2", teamA: "Vivi y Santy", teamB: "Alex y Flor", winner: "Vivi y Santy" },
  { time: "17:20 - 17:40", stage: "FINAL", teamA: "Lu y Gus", teamB: "Vivi y Santy", winner: "Lu y Gus" },
];

async function main(): Promise<void> {
  // Idempotent seed: wipe and rebuild from canonical data (cascade removes
  // teams, matches and the tournament state).
  await prisma.etapa.deleteMany();

  const etapa = await prisma.etapa.create({
    data: { name: "Etapa 5", sortOrder: 1 },
  });

  const teams = await Promise.all(
    TEAMS.map((team) =>
      prisma.team.create({
        data: { etapaId: etapa.id, name: team.name, zone: team.zone },
      }),
    ),
  );
  const teamIdByName = new Map(teams.map((team) => [team.name, team.id]));

  for (const [index, match] of MATCHES.entries()) {
    const hasSets = match.sets !== undefined;
    await prisma.match.create({
      data: {
        etapaId: etapa.id,
        slot: index + 1,
        timeLabel: match.time,
        stage: match.stage,
        zone: match.zone ?? null,
        // Groups are always single-set to 21; semis/final pick their format
        // live at load time (SINGLE_21 | TWO_15_TIEBREAK | BEST_OF_3_21).
        setFormat: match.stage === "GROUPS" ? "SINGLE_21" : null,
        teamAId: match.teamA ? (teamIdByName.get(match.teamA) ?? null) : null,
        teamBId: match.teamB ? (teamIdByName.get(match.teamB) ?? null) : null,
        // Loaded results from the brief: COMPLETE carries the SINGLE_21 sets,
        // WINNER_ONLY the official winner when the brief omits the score.
        resultStatus: hasSets
          ? "COMPLETE"
          : match.winner
            ? "WINNER_ONLY"
            : "PENDING",
        sets: hasSets
          ? [{ teamA: match.sets![0], teamB: match.sets![1] }]
          : undefined,
        winnerId: match.winner ? (teamIdByName.get(match.winner) ?? null) : null,
      },
    });
  }

  // Guard against typos in the canonical data: every loaded winner must belong
  // to its own match pair.
  const created = await prisma.match.findMany({
    where: { etapaId: etapa.id },
  });
  for (const matchResult of created) {
    if (!matchResult.winnerId) continue;
    if (
      matchResult.teamAId !== matchResult.winnerId &&
      matchResult.teamBId !== matchResult.winnerId
    ) {
      throw new Error(
        `Seed mismatch: winner of slot ${matchResult.slot} is not one of its pair ` +
          `(${matchResult.teamAId} vs ${matchResult.teamBId}, winner ${matchResult.winnerId})`,
      );
    }
  }

  // The etapa is finished: every result is in, so the stage is closed at
  // ELIMINATORIES with the zones confirmed.
  await prisma.tournamentState.create({
    data: {
      etapaId: etapa.id,
      zoneConfirmed: true,
      phase: "ELIMINATORIES",
    },
  });

  const teamCount = await prisma.team.count();
  const matchCount = await prisma.match.count();
  const withTeams = await prisma.match.count({
    where: { teamAId: { not: null } },
  });
  const resolved = await prisma.match.count({
    where: { resultStatus: { not: "PENDING" } },
  });

  if (
    teamCount !== TEAMS.length ||
    matchCount !== MATCHES.length ||
    resolved !== MATCHES.length
  ) {
    throw new Error(
      `Seed mismatch: ${teamCount} teams / ${matchCount} matches / ` +
        `${resolved} resolved expected ${TEAMS.length}/${MATCHES.length}/${MATCHES.length}`,
    );
  }

  console.log(
    `Seed OK — etapa "${etapa.name}", ${teamCount} teams, ${matchCount} matches ` +
      `${withTeams} with fixed pairs, ${matchCount - withTeams} bracket slots, ` +
      `${resolved} with loaded results.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
/**
 * Circuito seed — CANONICAL LOADED DATA from the briefs + official plantillas.
 *
 * Three etapas are loaded (idempotent wipe-and-rebuild):
 * - Etapa 1 (REPECHAJE): 6 teams (Zona A: Roxi y Gastón, Ángela y Migue,
 *   Seba y Sil; Zona B: Mati y Cin, Kari y Santi, Vivi y Andrés). 6 group
 *   matches with SINGLE_21 results and REPECHAJE eliminatorias (2°A vs 3°B,
 *   2°B vs 3°A, semis vs 1°, bronze and final), all WINNER_ONLY (scores not
 *   in the brief). Official positions: 1 Roxi y Gastón, 2 Mati y Cin,
 *   3 Vivi y Andrés, 4 Kari y Santi, 5-6 Ángela y Migue / Seba y Sil.
 * - Etapa 3 (REPECHAJE): 7 teams (Zona A: Mati y Cin, Seba y Sil, Cami y
 *   Deivid, Roxi y Jony; Zona B: More y Gus, Clary y Santi, Gabi y Cami).
 *   9 group matches with SINGLE_21 results and REPECHAJE eliminatorias,
 *   WINNER_ONLY. Official positions: 1 More y Gus, 2 Roxi y Jony,
 *   3 Mati y Cin, 4 Clary y Santi, 5 Seba y Sil, 6 Gabi y Cami,
 *   7 Cami y Deivid.
 * - Etapa 5 (STANDARD): the existing canonical brief data (10 teams, 20
 *   group matches + semis + final).
 *
 * Player identity (maleName/femaleName) is normalized so the annual ranking
 * sums per person across etapas (S5):
 * - Seba (E1/E3) is the same person as Sebita (E5) -> maleName "Sebita".
 * - Santi (E1/E3) is the same person as Santy (E5) -> maleName "Santy".
 * - Gus (E3/E5) is NOT Gastón (E1) -> two different maleNames.
 * - Gabi sz (E3, plays with Cami) is NOT Gabi (E5, plays with Nabi).
 * - Cami (E3, plays with Gabi sz) is NOT Cami C (E3, plays with Deivid).
 * - Female dictation: Roxi, Ángela, Sil, Vivi, Kari, Cin, Cami, More, Clary,
 *   Cami C are women; the rest of each fixed pair is the man.
 *
 * Every etapa is finished: ELIMINATORIES with zoneConfirmed, all results in.
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
  | "REPECHAJE_1"
  | "REPECHAJE_2"
  | "SEMIFINAL_1"
  | "SEMIFINAL_2"
  | "BRONZE"
  | "FINAL";
type BracketKind = "STANDARD" | "REPECHAJE";

interface TeamRow {
  name: string;
  zone: Zone;
  maleName?: string;
  femaleName?: string;
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

interface EtapaSeed {
  name: string;
  sortOrder: number;
  bracketKind: BracketKind;
  teams: TeamRow[];
  matches: MatchRow[];
}

const ETAPAS: EtapaSeed[] = [
  // ------------------------------------------------------------------ Etapa 1
  {
    name: "Etapa 1",
    sortOrder: 1,
    bracketKind: "REPECHAJE",
    teams: [
      { name: "Roxi y Gastón", zone: "A", femaleName: "Roxi", maleName: "Gastón" },
      { name: "Ángela y Migue", zone: "A", femaleName: "Ángela", maleName: "Migue" },
      { name: "Seba y Sil", zone: "A", femaleName: "Sil", maleName: "Sebita" },
      { name: "Mati y Cin", zone: "B", maleName: "Mati", femaleName: "Cin" },
      { name: "Kari y Santi", zone: "B", femaleName: "Kari", maleName: "Santy" },
      { name: "Vivi y Andrés", zone: "B", femaleName: "Vivi", maleName: "Andrés" },
    ],
    matches: [
      { time: "10:40 - 11:00", stage: "GROUPS", zone: "A", teamA: "Ángela y Migue", teamB: "Seba y Sil", sets: [21, 17], winner: "Ángela y Migue" },
      { time: "11:20 - 11:40", stage: "GROUPS", zone: "B", teamA: "Vivi y Andrés", teamB: "Kari y Santi", sets: [13, 21], winner: "Kari y Santi" },
      { time: "12:00 - 12:20", stage: "GROUPS", zone: "A", teamA: "Roxi y Gastón", teamB: "Ángela y Migue", sets: [21, 18], winner: "Roxi y Gastón" },
      { time: "12:40 - 13:00", stage: "GROUPS", zone: "B", teamA: "Vivi y Andrés", teamB: "Mati y Cin", sets: [14, 21], winner: "Mati y Cin" },
      { time: "13:20 - 13:40", stage: "GROUPS", zone: "A", teamA: "Roxi y Gastón", teamB: "Seba y Sil", sets: [21, 14], winner: "Roxi y Gastón" },
      // Brief shows no score: WINNER_ONLY Mati y Cin.
      { time: "14:00 - 14:20", stage: "GROUPS", zone: "B", teamA: "Kari y Santi", teamB: "Mati y Cin", winner: "Mati y Cin" },
      // Eliminatorias — winners match the official plantilla; scores not in brief.
      { time: "14:40 - 15:00", stage: "REPECHAJE_1", teamA: "Ángela y Migue", teamB: "Vivi y Andrés", winner: "Vivi y Andrés" },
      { time: "15:20 - 15:40", stage: "REPECHAJE_2", teamA: "Kari y Santi", teamB: "Seba y Sil", winner: "Kari y Santi" },
      { time: "16:00 - 16:20", stage: "SEMIFINAL_1", teamA: "Roxi y Gastón", teamB: "Kari y Santi", winner: "Roxi y Gastón" },
      { time: "16:40 - 17:00", stage: "SEMIFINAL_2", teamA: "Mati y Cin", teamB: "Vivi y Andrés", winner: "Mati y Cin" },
      { time: "17:20 - 17:40", stage: "BRONZE", teamA: "Kari y Santi", teamB: "Vivi y Andrés", winner: "Vivi y Andrés" },
      { time: "18:00 - 18:20", stage: "FINAL", teamA: "Roxi y Gastón", teamB: "Mati y Cin", winner: "Roxi y Gastón" },
    ],
  },
  // ------------------------------------------------------------------ Etapa 3
  {
    name: "Etapa 3",
    sortOrder: 2,
    bracketKind: "REPECHAJE",
    teams: [
      { name: "Mati y Cin", zone: "A", maleName: "Mati", femaleName: "Cin" },
      { name: "Seba y Sil", zone: "A", femaleName: "Sil", maleName: "Sebita" },
      { name: "Cami y Deivid", zone: "A", femaleName: "Cami C", maleName: "Deivid" },
      { name: "Roxi y Jony", zone: "A", femaleName: "Roxi", maleName: "Jony" },
      { name: "More y Gus", zone: "B", femaleName: "More", maleName: "Gus" },
      { name: "Clary y Santi", zone: "B", femaleName: "Clary", maleName: "Santy" },
      { name: "Gabi y Cami", zone: "B", maleName: "Gabi sz", femaleName: "Cami" },
    ],
    matches: [
      { time: "11:00 - 11:20", stage: "GROUPS", zone: "A", teamA: "Mati y Cin", teamB: "Seba y Sil", sets: [21, 17], winner: "Mati y Cin" },
      { time: "11:20 - 11:40", stage: "GROUPS", zone: "B", teamA: "More y Gus", teamB: "Clary y Santi", sets: [21, 14], winner: "More y Gus" },
      { time: "11:40 - 12:00", stage: "GROUPS", zone: "A", teamA: "Cami y Deivid", teamB: "Mati y Cin", sets: [14, 21], winner: "Mati y Cin" },
      { time: "12:00 - 12:20", stage: "GROUPS", zone: "B", teamA: "More y Gus", teamB: "Gabi y Cami", sets: [21, 13], winner: "More y Gus" },
      { time: "12:20 - 12:40", stage: "GROUPS", zone: "A", teamA: "Cami y Deivid", teamB: "Seba y Sil", sets: [16, 21], winner: "Seba y Sil" },
      { time: "12:40 - 13:00", stage: "GROUPS", zone: "A", teamA: "Roxi y Jony", teamB: "Mati y Cin", sets: [21, 13], winner: "Roxi y Jony" },
      { time: "13:00 - 13:20", stage: "GROUPS", zone: "B", teamA: "Clary y Santi", teamB: "Gabi y Cami", sets: [21, 15], winner: "Clary y Santi" },
      { time: "13:20 - 13:40", stage: "GROUPS", zone: "A", teamA: "Roxi y Jony", teamB: "Cami y Deivid", sets: [21, 11], winner: "Roxi y Jony" },
      { time: "13:40 - 14:00", stage: "GROUPS", zone: "A", teamA: "Roxi y Jony", teamB: "Seba y Sil", sets: [21, 12], winner: "Roxi y Jony" },
      // Eliminatorias — winners match the official plantilla; scores not in brief.
      { time: "14:00 - 14:20", stage: "REPECHAJE_1", teamA: "Mati y Cin", teamB: "Gabi y Cami", winner: "Mati y Cin" },
      { time: "14:20 - 14:40", stage: "REPECHAJE_2", teamA: "Clary y Santi", teamB: "Seba y Sil", winner: "Clary y Santi" },
      { time: "14:40 - 15:00", stage: "SEMIFINAL_1", teamA: "Roxi y Jony", teamB: "Clary y Santi", winner: "Roxi y Jony" },
      { time: "15:20 - 15:40", stage: "SEMIFINAL_2", teamA: "More y Gus", teamB: "Mati y Cin", winner: "More y Gus" },
      { time: "16:00 - 16:20", stage: "BRONZE", teamA: "Clary y Santi", teamB: "Mati y Cin", winner: "Mati y Cin" },
      { time: "16:20 - 16:40", stage: "FINAL", teamA: "Roxi y Jony", teamB: "More y Gus", winner: "More y Gus" },
    ],
  },
  // ------------------------------------------------------------------ Etapa 5
  {
    name: "Etapa 5",
    sortOrder: 3,
    bracketKind: "STANDARD",
    teams: [
      { name: "Lu y Gus", zone: "A", femaleName: "Lu", maleName: "Gus" },
      { name: "Alex y Flor", zone: "A", maleName: "Alex", femaleName: "Flor" },
      { name: "Gon y Belén", zone: "A", maleName: "Gon", femaleName: "Belén" },
      { name: "Gabi y Nabi", zone: "A", maleName: "Gabi", femaleName: "Nabi" },
      { name: "Liz y Sebita", zone: "A", femaleName: "Liz", maleName: "Sebita" },
      { name: "Vivi y Santy", zone: "B", femaleName: "Vivi", maleName: "Santy" },
      { name: "Mati y Cin", zone: "B", maleName: "Mati", femaleName: "Cin" },
      { name: "Roxi y Dany", zone: "B", femaleName: "Roxi", maleName: "Dany" },
      { name: "Enzo y Kari", zone: "B", maleName: "Enzo", femaleName: "Kari" },
      { name: "Sil y Lucas", zone: "B", femaleName: "Sil", maleName: "Lucas" },
    ],
    matches: [
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
    ],
  },
];

async function main(): Promise<void> {
  // Idempotent seed: wipe and rebuild from canonical data (cascade removes
  // teams, matches and the tournament state).
  await prisma.etapa.deleteMany();

  const expectedTeams = ETAPAS.reduce((n, e) => n + e.teams.length, 0);
  const expectedMatches = ETAPAS.reduce((n, e) => n + e.matches.length, 0);

  for (const seed of ETAPAS) {
    const etapa = await prisma.etapa.create({
      data: {
        name: seed.name,
        sortOrder: seed.sortOrder,
        bracketFormat: seed.bracketKind,
      },
    });

    const teams = await Promise.all(
      seed.teams.map((team) =>
        prisma.team.create({
          data: {
            etapaId: etapa.id,
            name: team.name,
            zone: team.zone,
            maleName: team.maleName ?? null,
            femaleName: team.femaleName ?? null,
          },
        }),
      ),
    );
    const teamIdByName = new Map(teams.map((team) => [team.name, team.id]));

    for (const [index, match] of seed.matches.entries()) {
      const hasSets = match.sets !== undefined;
      await prisma.match.create({
        data: {
          etapaId: etapa.id,
          slot: index + 1,
          timeLabel: match.time,
          stage: match.stage,
          zone: match.zone ?? null,
          // Groups are always single-set to 21; eliminatorias pick their
          // format live at load time (SINGLE_21 | TWO_15_TIEBREAK |
          // BEST_OF_3_21).
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

    // Guard against typos in the canonical data: every loaded winner must
    // belong to its own match pair.
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
          `Seed mismatch in ${seed.name}: winner of slot ${matchResult.slot} is not ` +
            `one of its pair (${matchResult.teamAId} vs ${matchResult.teamBId}, ` +
            `winner ${matchResult.winnerId})`,
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

    console.log(
      `Seed OK — etapa "${seed.name}" (${seed.bracketKind}), ` +
        `${seed.teams.length} teams, ${seed.matches.length} matches.`,
    );
  }

  const teamCount = await prisma.team.count();
  const matchCount = await prisma.match.count();
  const resolved = await prisma.match.count({
    where: { resultStatus: { not: "PENDING" } },
  });

  if (teamCount !== expectedTeams || matchCount !== expectedMatches) {
    throw new Error(
      `Seed mismatch: ${teamCount} teams / ${matchCount} matches expected ` +
        `${expectedTeams}/${expectedMatches}`,
    );
  }

  console.log(
    `Total: ${teamCount} teams, ${matchCount} matches, ` +
      `${resolved} with loaded results.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
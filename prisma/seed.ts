/**
 * Etapa 5 seed — canonical data from the brief:
 * - 10 teams split into Zona A / Zona B (fixed by the brief).
 * - 23 matches: 20 group-phase (fixed pairs + times, single court),
 *   semifinals (A1 vs B2, B1 vs A2) and the final — all PENDING.
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
  { time: "10:00 - 10:20", stage: "GROUPS", zone: "A", teamA: "Lu y Gus", teamB: "Alex y Flor" },
  { time: "10:20 - 10:40", stage: "GROUPS", zone: "B", teamA: "Vivi y Santy", teamB: "Mati y Cin" },
  { time: "10:40 - 11:00", stage: "GROUPS", zone: "A", teamA: "Gon y Belén", teamB: "Gabi y Nabi" },
  { time: "11:00 - 11:20", stage: "GROUPS", zone: "B", teamA: "Roxi y Dany", teamB: "Enzo y Kari" },
  { time: "11:20 - 11:40", stage: "GROUPS", zone: "A", teamA: "Liz y Sebita", teamB: "Lu y Gus" },
  { time: "11:40 - 12:00", stage: "GROUPS", zone: "B", teamA: "Sil y Lucas", teamB: "Vivi y Santy" },
  { time: "12:00 - 12:20", stage: "GROUPS", zone: "A", teamA: "Alex y Flor", teamB: "Gon y Belén" },
  { time: "12:20 - 12:40", stage: "GROUPS", zone: "B", teamA: "Mati y Cin", teamB: "Roxi y Dany" },
  { time: "12:40 - 13:00", stage: "GROUPS", zone: "A", teamA: "Gabi y Nabi", teamB: "Liz y Sebita" },
  { time: "13:00 - 13:20", stage: "GROUPS", zone: "B", teamA: "Enzo y Kari", teamB: "Sil y Lucas" },
  { time: "13:20 - 13:40", stage: "GROUPS", zone: "A", teamA: "Lu y Gus", teamB: "Gon y Belén" },
  { time: "13:40 - 14:00", stage: "GROUPS", zone: "B", teamA: "Vivi y Santy", teamB: "Roxi y Dany" },
  { time: "14:00 - 14:20", stage: "GROUPS", zone: "A", teamA: "Alex y Flor", teamB: "Gabi y Nabi" },
  { time: "14:20 - 14:40", stage: "GROUPS", zone: "B", teamA: "Mati y Cin", teamB: "Enzo y Kari" },
  { time: "14:40 - 15:00", stage: "GROUPS", zone: "A", teamA: "Gon y Belén", teamB: "Liz y Sebita" },
  { time: "15:00 - 15:20", stage: "GROUPS", zone: "B", teamA: "Roxi y Dany", teamB: "Sil y Lucas" },
  { time: "15:20 - 15:40", stage: "GROUPS", zone: "A", teamA: "Gabi y Nabi", teamB: "Lu y Gus" },
  { time: "15:40 - 16:00", stage: "GROUPS", zone: "B", teamA: "Enzo y Kari", teamB: "Vivi y Santy" },
  { time: "16:00 - 16:20", stage: "GROUPS", zone: "A", teamA: "Liz y Sebita", teamB: "Alex y Flor" },
  { time: "16:20 - 16:40", stage: "GROUPS", zone: "B", teamA: "Sil y Lucas", teamB: "Mati y Cin" },
  { time: "16:40 - 17:00", stage: "SEMIFINAL_1" },
  { time: "17:00 - 17:20", stage: "SEMIFINAL_2" },
  { time: "17:20 - 17:40", stage: "FINAL" },
];

async function main(): Promise<void> {
  // Idempotent seed: wipe and rebuild from canonical data.
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();

  const teams = await Promise.all(
    TEAMS.map((team) =>
      prisma.team.create({ data: { name: team.name, zone: team.zone } }),
    ),
  );
  const teamIdByName = new Map(teams.map((team) => [team.name, team.id]));

  for (const [index, match] of MATCHES.entries()) {
    await prisma.match.create({
      data: {
        slot: index + 1,
        timeLabel: match.time,
        stage: match.stage,
        zone: match.zone ?? null,
        teamAId: match.teamA ? (teamIdByName.get(match.teamA) ?? null) : null,
        teamBId: match.teamB ? (teamIdByName.get(match.teamB) ?? null) : null,
        resultStatus: "PENDING",
      },
    });
  }

  const teamCount = await prisma.team.count();
  const matchCount = await prisma.match.count();
  const withTeams = await prisma.match.count({
    where: { teamAId: { not: null } },
  });

  await prisma.tournamentState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  if (teamCount !== TEAMS.length || matchCount !== MATCHES.length) {
    throw new Error(
      `Seed mismatch: ${teamCount} teams / ${matchCount} matches expected ${TEAMS.length}/${MATCHES.length}`,
    );
  }

  console.log(
    `Seed OK — ${teamCount} teams, ${matchCount} matches ` +
      `(${withTeams} with fixed pairs, ${matchCount - withTeams} bracket slots).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
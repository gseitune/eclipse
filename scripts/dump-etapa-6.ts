// One-shot (not committed): read-only dump of Etapa 6 for manual verification.
// Prints the group fixture and the bracket so the result can be compared with the
// organizer's real sheet after results are loaded again.
//
// Usage (from the repo root):
//   $env:DATABASE_URL = "file:./prisma/dev.db"
//   npx tsx scripts/dump-etapa-6.ts

import { prisma } from "../src/lib/prisma";

const ETAPA_NAME = process.argv[2] ?? "Etapa 6";

async function main() {
  const etapa = await prisma.etapa.findFirst({
    where: { name: ETAPA_NAME },
    select: { id: true, name: true, bracketFormat: true },
  });
  if (!etapa) throw new Error(`Etapa "${ETAPA_NAME}" not found`);

  const teams = await prisma.team.findMany({
    where: { etapaId: etapa.id },
    select: { id: true, name: true, zone: true },
  });
  const nameOf = new Map(teams.map((t) => [t.id, t.name]));
  const label = (id: string | null) => (id ? (nameOf.get(id) ?? `??${id}`) : "—");

  const matches = await prisma.match.findMany({
    where: { etapaId: etapa.id },
    orderBy: { slot: "asc" },
    select: {
      slot: true,
      stage: true,
      zone: true,
      teamAId: true,
      teamBId: true,
      resultStatus: true,
      sets: true,
    },
  });

  const state = await prisma.tournamentState.findUnique({
    where: { etapaId: etapa.id },
    select: { phase: true, zoneConfirmed: true },
  });

  console.log(`Etapa: ${etapa.name} (${etapa.id}) format=${etapa.bracketFormat}`);
  console.log(
    `State: phase=${state?.phase} zoneConfirmed=${state?.zoneConfirmed} | teams=${teams.length} matches=${matches.length}`,
  );

  console.log("\n=== FIXTURE DE ZONA ===");
  const groups = matches.filter((m) => m.stage === "GROUPS");
  for (const zone of ["A", "B", "C"]) {
    const zg = groups.filter((m) => m.zone === zone);
    const names = teams.filter((t) => t.zone === zone).map((t) => t.name);
    console.log(`\nZona ${zone} (${names.length}): ${names.join(" | ")}`);
    for (const m of zg) {
      const sets = Array.isArray(m.sets) ? (m.sets as { teamA: number; teamB: number }[]) : [];
      const score = sets.length
        ? sets.map((s) => `${s.teamA}-${s.teamB}`).join(" ")
        : "(sin resultado)";
      console.log(`  slot ${String(m.slot).padStart(2)} [${m.resultStatus}] ${label(m.teamAId)} vs ${label(m.teamBId)}  ${score}`);
    }
  }

  console.log("\n=== BRACKET ===");
  for (const m of matches.filter((m) => m.stage !== "GROUPS")) {
    console.log(
      `  ${m.stage.padEnd(12)} slot ${String(m.slot).padStart(2)} [${m.resultStatus}] ${label(m.teamAId)} vs ${label(m.teamBId)}`,
    );
  }

  const decided = matches.filter((m) => m.resultStatus !== "PENDING").length;
  console.log(`\nResultados: ${decided}/${matches.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

// One-shot (not committed): list etapas in the live DB and hunt for stub
// test teams named "Eq*" that should never exist outside throwaway test DBs.
//
// Usage (from the repo root):
//   $env:DATABASE_URL = "file:./prisma/dev.db"
//   npx tsx scripts/inspect-etapas.ts

import { prisma } from "../src/lib/prisma";

async function main() {
  const etapas = await prisma.etapa.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  console.log(`Etapas: ${etapas.length}`);
  for (const e of etapas) {
    const [teams, matches] = await Promise.all([
      prisma.team.count({ where: { etapaId: e.id } }),
      prisma.match.count({ where: { etapaId: e.id } }),
    ]);
    const state = await prisma.tournamentState.findUnique({ where: { etapaId: e.id } });
    console.log(
      `  [${e.sortOrder}] ${e.name} (${e.id}) teams=${teams} matches=${matches} phase=${state?.phase ?? "-"}`,
    );
  }

  const stubTeams = await prisma.team.findMany({
    where: { name: { startsWith: "Eq" } },
    select: { name: true, etapa: { select: { id: true, name: true } } },
  });
  console.log(`\nTeams named "Eq*": ${stubTeams.length}`);
  for (const t of stubTeams) {
    console.log(`  ${t.name} -> etapa ${t.etapa.name} (${t.etapa.id})`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
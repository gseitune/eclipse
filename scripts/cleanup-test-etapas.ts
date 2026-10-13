// One-shot helper: delete test etapas that leaked into the live DB.
// The regression test in back.integration.test.ts created "Cuartos WinnerOnly"
// against prisma/dev.db during targeted `npx tsx --test` invocations.
//
// Usage (from the repo root):
//   $env:DATABASE_URL = "file:./prisma/dev.db"
//   npx tsx scripts/cleanup-test-etapas.ts
//
// Deleting an etapa is irreversible, so this goes through the remote-write
// guard: a remote database (production Turso) is refused unless --allow-remote
// is passed explicitly.

import { prisma } from "../src/lib/prisma";
import { assertRemoteWriteAllowed } from "./lib/remote-write-guard";

const TEST_ETAPA_NAMES = ["Cuartos WinnerOnly"];

async function main() {
  const etapas = await prisma.etapa.findMany({
    where: { name: { in: TEST_ETAPA_NAMES } },
    select: { id: true, name: true },
  });
  console.log(`Etapas de test encontradas: ${etapas.length}`);
  if (etapas.length > 0) {
    assertRemoteWriteAllowed({
      script: "cleanup-test-etapas.ts",
      action: `delete ${etapas.length} test etapa(s) with their teams, matches and state rows`,
    });
  }
  for (const e of etapas) {
    const teams = await prisma.team.deleteMany({ where: { etapaId: e.id } });
    const matches = await prisma.match.deleteMany({ where: { etapaId: e.id } });
    const states = await prisma.tournamentState.deleteMany({ where: { etapaId: e.id } });
    const etapa = await prisma.etapa.delete({ where: { id: e.id } });
    console.log(`  eliminada "${etapa.name}" (${etapa.id}) teams=${teams.count} matches=${matches.count} state=${states.count}`);
  }

  const remaining = await prisma.etapa.findMany({ select: { id: true, name: true, sortOrder: true } });
  console.log(`\nEtapas restantes: ${remaining.length}`);
  for (const r of remaining) console.log(`  [${r.sortOrder}] ${r.name} (${r.id})`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
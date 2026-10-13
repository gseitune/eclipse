// One-shot (not committed): repair CUARTOS_1 after a WINNER_ONLY REPECHAJE_1
// result was recorded before the fillDescendantMatches fix (resultStatus gate
// changed from "COMPLETE" to any non-PENDING). Re-applies the fixed branch's
// behavior: seed 8 (RE1 winner) lands in CUARTOS_1 next to seed 1 (A1).
//
// Usage (from the repo root):
//   $env:DATABASE_URL = "file:./prisma/dev.db"
//   npx tsx scripts/repair-cuartos1-from-re1.ts

import { prisma } from "../src/lib/prisma";

const ETAPA_NAME = "Etapa 6";

async function main() {
  const etapa = await prisma.etapa.findFirst({
    where: { name: ETAPA_NAME },
    select: { id: true, name: true },
  });
  if (!etapa) throw new Error(`Etapa "${ETAPA_NAME}" not found`);

  const re1 = await prisma.match.findFirst({
    where: { etapaId: etapa.id, stage: "REPECHAJE_1" },
    include: { teamA: true, teamB: true, winner: true },
  });
  if (!re1) throw new Error("REPECHAJE_1 not found");
  const winnerId = re1.winnerId;
  if (!winnerId) throw new Error("REPECHAJE_1 has no winner yet");

  const c1 = await prisma.match.findFirst({
    where: { etapaId: etapa.id, stage: "CUARTOS_1" },
    include: { teamA: true, teamB: true },
  });
  if (!c1) throw new Error("CUARTOS_1 not found");

  console.log(`REPECHAJE_1: ${re1.teamA?.name} vs ${re1.teamB?.name} [${re1.resultStatus}] winner=${re1.winner?.name}`);
  console.log(`CUARTOS_1 before: ${c1.teamA?.name ?? "—"} vs ${c1.teamB?.name ?? "—"}`);

  const updateData: Record<string, string> = {};
  if (c1.teamBId === null) updateData.teamBId = winnerId;
  else if (c1.teamAId === null) updateData.teamAId = winnerId;

  if (Object.keys(updateData).length === 0) {
    console.log("CUARTOS_1 already has both sides; nothing to repair.");
  } else {
    await prisma.match.update({ where: { id: c1.id }, data: updateData });
    const after = await prisma.match.findUnique({
      where: { id: c1.id },
      include: { teamA: true, teamB: true },
    });
    console.log(`CUARTOS_1 after: ${after?.teamA?.name ?? "—"} vs ${after?.teamB?.name ?? "—"}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
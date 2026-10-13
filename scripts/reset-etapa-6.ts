// One-shot (not committed): reset Etapa 6 back to the group phase with no
// results recorded, so the existing fixture can be re-entered and the new
// CUARTOS seeding verified against the organizer's real bracket.
//
// Teams, zones and the group fixture are preserved on purpose: re-creating the
// etapa would re-randomize the zones and make the comparison meaningless.
//
// Usage (from the repo root):
//   $env:DATABASE_URL = "file:./prisma/dev.db"
//   npx tsx scripts/reset-etapa-6.ts

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const ETAPA_NAME = "Etapa 6";

async function main() {
  const etapa = await prisma.etapa.findFirst({
    where: { name: ETAPA_NAME },
    select: { id: true, name: true, bracketFormat: true },
  });
  if (!etapa) throw new Error(`Etapa "${ETAPA_NAME}" not found`);
  const etapaId = etapa.id;
  console.log(`Target: ${etapa.name} (${etapaId}) format=${etapa.bracketFormat}`);

  const before = await prisma.match.findMany({
    where: { etapaId, stage: { not: "GROUPS" } },
    orderBy: { slot: "asc" },
    select: { stage: true, slot: true, resultStatus: true },
  });
  console.log(`Bracket slots before: ${before.length}`);

  // 1. Clear every recorded result (group + bracket).
  const cleared = await prisma.match.updateMany({
    where: { etapaId },
    data: {
      sets: Prisma.DbNull,
      setFormat: null,
      resultStatus: "PENDING",
      winnerId: null,
      recordedAt: null,
      manualStartAt: null,
      manualEndAt: null,
    },
  });
  console.log(`Cleared results on ${cleared.count} matches`);

  // 2. Drop the bracket side teams so finalizeBrackets republishes them.
  const wiped = await prisma.match.updateMany({
    where: { etapaId, stage: { not: "GROUPS" } },
    data: { teamAId: null, teamBId: null },
  });
  console.log(`Cleared bracket teams on ${wiped.count} matches`);

  // 3. Back to the group phase.
  const state = await prisma.tournamentState.update({
    where: { etapaId },
    data: { phase: "GROUPS" },
    select: { phase: true, zoneConfirmed: true },
  });
  console.log(`State: phase=${state.phase} zoneConfirmed=${state.zoneConfirmed}`);

  const pending = await prisma.match.count({
    where: { etapaId, resultStatus: "PENDING" },
  });
  const decided = await prisma.match.count({
    where: { etapaId, resultStatus: { not: "PENDING" } },
  });
  const teams = await prisma.team.count({ where: { etapaId } });
  console.log(`Matches: ${pending} pending / ${decided} decided`);
  console.log(`Teams preserved: ${teams}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

// One-shot (not committed): create Etapa 6 with the exact zones from the
// fixture sheet and confirm the zonification.
//
// Usage:
//   $env:DATABASE_URL = "libsql://..."
//   $env:TURSO_AUTH_TOKEN = "<token>"
//   npx tsx scripts/create-etapa-6.ts
//
// Teams are listed in zone order (A:4, B:4, C:3) and distributeTeams keeps
// input order with an rng that makes A and B carry the extra team, so the
// resulting zones match the fixture exactly.

import { createEtapa, confirmZonification, getTeamsByZone } from "../src/lib/back";
import { prisma } from "../src/lib/prisma";

const teams = [
  // Zona A (4)
  { name: "Ruth y Yuli", maleName: "Yuli", femaleName: "Ruth" },
  { name: "Gus y Gise", maleName: "Gus", femaleName: "Gise" },
  { name: "Vivi y Santy", maleName: "Santy", femaleName: "Vivi" },
  { name: "Seba y Liz", maleName: "Seba", femaleName: "Liz" },
  // Zona B (4)
  { name: "Lu y Mateo", maleName: "Mateo", femaleName: "Lu" },
  { name: "Dany y Ángela", maleName: "Dany", femaleName: "Ángela" },
  { name: "Roxi y Gaso", maleName: "Gaso", femaleName: "Roxi" },
  { name: "Maxi y Kari", maleName: "Maxi", femaleName: "Kari" },
  // Zona C (3)
  { name: "Mati y Cin", maleName: "Mati", femaleName: "Cin" },
  { name: "Gonza y Belén", maleName: "Gonza", femaleName: "Belén" },
  { name: "Gabi y Nabi", maleName: "Gabi", femaleName: "Nabi" },
];

console.log("Creating Etapa 6 (CUARTOS)...");
async function main() {
  const created = await createEtapa(
    { name: "Etapa 6", date: "2026-09-27", bracketFormat: "CUARTOS", teams },
    { rng: () => 0.999 },
  );
  console.log("Created:", JSON.stringify(created));

  await confirmZonification(created.id);
  console.log("Zonification confirmed.");

  const byZone = await getTeamsByZone(created.id);
  for (const z of ["A", "B", "C"] as const) {
    const list = byZone[z].map((t) => `${t.name} (${t.maleName}/${t.femaleName})`);
    console.log(`Zona ${z} (${list.length}): ${list.join(" | ")}`);
  }

  const matchCount = await prisma.match.count({ where: { etapaId: created.id } });
  console.log(`Total matches in Etapa 6: ${matchCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
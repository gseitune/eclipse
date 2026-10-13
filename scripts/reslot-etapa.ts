// One-shot (not committed): re-assign the slot order of an existing etapa's
// group (round-robin) matches to the interleaved rotation (A, B, C, A, B, C…),
// so the running fixture matches what a freshly created etapa produces
// (see src/lib/tournament.ts -> interleaveGroupPairs).
//
// Pairs, results and bracket slots are NOT touched: only the GROUPS matches'
// `slot` numbers change. The bracket slots keep their current numbers (they
// already sit after the group block).
//
// Why: the rotation fix only applies when an etapa is CREATED. Etapas created
// before it keep the old "zone by zone" order and need this one-shot pass.
//
// Usage (dry-run prints the new order, writes nothing):
//   npx tsx scripts/reslot-etapa.ts --etapa "Etapa 6"
//   npx tsx scripts/reslot-etapa.ts            # defaults to the latest etapa
//
// Apply (writes to whatever DB the env points at):
//   npx tsx scripts/reslot-etapa.ts --etapa "Etapa 6" --apply
//
// Against production Turso, set the same env vars the app uses:
//   $env:TURSO_DATABASE_URL = "libsql://..."
//   $env:TURSO_AUTH_TOKEN   = "<token>"
//   npx tsx scripts/reslot-etapa.ts --etapa "Etapa 6" --apply
// Otherwise it uses the local sqlite DATABASE_URL (.env.local).

import { prisma } from "../src/lib/prisma";

interface Args {
  etapa?: string;
  apply: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--etapa") args.etapa = argv[++i];
  }
  return args;
}

async function resolveEtapa(selector?: string) {
  if (selector) {
    const byId = await prisma.etapa.findUnique({ where: { id: selector } });
    if (byId) return byId;
    const byName = await prisma.etapa.findFirst({
      where: { name: selector },
      orderBy: { sortOrder: "desc" },
    });
    if (byName) return byName;
    throw new Error(`No etapa found with id or name "${selector}"`);
  }
  const latest = await prisma.etapa.findFirst({ orderBy: { sortOrder: "desc" } });
  if (!latest) throw new Error("No etapa found in this database.");
  return latest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const etapa = await resolveEtapa(args.etapa);

  // GROUPS matches, in current slot order. Within each zone this order already
  // matches roundRobinPairs() (the order createEtapa used), so interleaving
  // the per-zone queues by index reproduces interleaveGroupPairs() exactly.
  const groupMatches = await prisma.match.findMany({
    where: { etapaId: etapa.id, stage: "GROUPS" },
    orderBy: { slot: "asc" },
    include: { teamA: true, teamB: true },
  });

  if (groupMatches.length === 0) {
    throw new Error(`Etapa "${etapa.name}" has no GROUPS matches.`);
  }

  const queues = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (m.zone === null) continue;
    const key = String(m.zone);
    const bucket = queues.get(key);
    if (bucket) bucket.push(m);
    else queues.set(key, [m]);
  }
  const zones = [...queues.keys()].sort();

  const plan: { match: (typeof groupMatches)[number]; newSlot: number }[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const z of zones) {
      const q = queues.get(z)!;
      if (q.length > 0) {
        plan.push({ match: q.shift()!, newSlot: plan.length + 1 });
        progressed = true;
      }
    }
  }

  console.log(`Etapa: ${etapa.name} (${etapa.id})`);
  console.log(`Zonas: ${zones.join(", ")} — ${groupMatches.length} partidos de zona, ${plan.length} reubicados`);
  console.log(args.apply ? "MODE: APPLY (escribe en la DB)" : "MODE: dry-run (no escribe nada)");
  console.log("");
  console.log("new | old | zona | partido                          | estado");
  console.log("----|-----|------|----------------------------------|---------");
  for (const { match, newSlot } of plan) {
    const label =
      match.teamA && match.teamB ? `${match.teamA.name} vs ${match.teamB.name}` : "Por definir";
    console.log(
      `${String(newSlot).padStart(3)} | ${String(match.slot).padStart(3)} | ${(match.zone ?? "-").padEnd(4)} | ${label.padEnd(32)} | ${match.resultStatus}`,
    );
  }

  const changed = plan.filter(({ match, newSlot }) => match.slot !== newSlot);
  console.log("");
  console.log(`Cambios: ${changed.length} de ${plan.length} partidos.`);

  if (!args.apply) {
    console.log("Dry-run: no se escribió nada. Agregá --apply para aplicar.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(
    plan.map(({ match, newSlot }) =>
      prisma.match.update({ where: { id: match.id }, data: { slot: newSlot } }),
    ),
  );
  console.log(`Aplicado: ${plan.length} slots actualizados.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

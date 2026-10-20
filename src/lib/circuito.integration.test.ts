import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

/**
 * Circuito = temporada anual. Each circuit numbers its etapas from 1 and its
 * annual table reads only its own etapas, so resolution, listing and creation
 * must all agree on (circuit, season).
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "selvarena-circuito-"));
const dbPath = join(dir, "test.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;

// Never touch a real database, whatever the parent shell exported.
process.env.DATABASE_URL = dbUrl;
process.env.TURSO_DATABASE_URL = "";
process.env.DATABASE_AUTH_TOKEN = "";

type BackModule = typeof import("./back");
type PrismaModule = typeof import("./prisma");

let createEtapa!: BackModule["createEtapa"];
let listEtapas!: BackModule["listEtapas"];
let resolveEtapaId!: BackModule["resolveEtapaId"];
let recordResult!: BackModule["recordResult"];
let generateZones!: BackModule["generateZones"];
let swapTeam!: BackModule["swapTeam"];
let deleteEtapa!: BackModule["deleteEtapa"];
let createCancelledEtapa!: BackModule["createCancelledEtapa"];
let getGalleryFolder!: BackModule["getGalleryFolder"];
let setGalleryFolder!: BackModule["setGalleryFolder"];
let prisma!: PrismaModule["prisma"];

function teams(prefix: string) {
  return Array.from({ length: 6 }, (_, i) => ({
    name: `${prefix} ${i + 1}`,
    maleName: `Hombre ${prefix}${i + 1}`,
    femaleName: `Mujer ${prefix}${i + 1}`,
  }));
}

describe("circuito = temporada anual", () => {
  before(async () => {
    process.env.DATABASE_URL = dbUrl;
    execSync(`npx prisma db push --url ${dbUrl}`, { cwd: repoRoot, stdio: "pipe" });
    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    createEtapa = back.createEtapa;
    listEtapas = back.listEtapas;
    resolveEtapaId = back.resolveEtapaId;
    recordResult = back.recordResult;
    generateZones = back.generateZones;
    swapTeam = back.swapTeam;
    deleteEtapa = back.deleteEtapa;
    createCancelledEtapa = back.createCancelledEtapa;
    getGalleryFolder = back.getGalleryFolder;
    setGalleryFolder = back.setGalleryFolder;
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("numbers each circuit from 1, independently", async () => {
    const p1 = await createEtapa({ name: "Principiantes 1", teams: teams("P1") });
    const p2 = await createEtapa({ name: "Principiantes 2", teams: teams("P2") });
    const i1 = await createEtapa({
      name: "Intermedios 1",
      teams: teams("I1"),
      circuit: "INTERMEDIOS",
    });

    assert.equal(p1.sortOrder, 1);
    assert.equal(p2.sortOrder, 2);
    assert.equal(i1.sortOrder, 1, "a new circuit starts its own numbering");
  });

  it("keeps numbering gap-safe when an earlier etapa is gone", async () => {
    // The real database kept a stage numbered 2 with no stage 1 left behind:
    // numbering must follow the highest number in use, never the row count.
    const first = await prisma.etapa.findFirst({ where: { name: "Principiantes 1" } });
    assert.ok(first);
    await prisma.etapa.delete({ where: { id: first.id } });

    const next = await createEtapa({ name: "Principiantes 3", teams: teams("P3") });
    assert.equal(next.sortOrder, 3, "max(sortOrder) + 1, not count + 1");
  });

  it("resolves the latest etapa of the requested circuit", async () => {
    const med = await resolveEtapaId(null, "INTERMEDIOS");
    const pro = await resolveEtapaId(null);
    assert.equal(await prisma.etapa.findUnique({ where: { id: med }, select: { circuit: true } }).then((e) => e?.circuit), "INTERMEDIOS");
    assert.equal(await prisma.etapa.findUnique({ where: { id: pro }, select: { circuit: true } }).then((e) => e?.circuit), "PRINCIPIANTES");
  });

  it("lists only the etapas of the requested circuit", async () => {
    const all = await listEtapas();
    const med = await listEtapas("INTERMEDIOS");
    assert.ok(all.every((e) => e.circuit === "PRINCIPIANTES"));
    assert.equal(med.length, 1);
    assert.equal(med[0]?.circuit, "INTERMEDIOS");
  });

  it("STANDARD always schedules the third-place match", async () => {
    const etapa = await createEtapa({ name: "Con bronce", teams: teams("G") });
    const stages = (
      await prisma.match.findMany({
        where: { etapaId: etapa.id },
        select: { stage: true },
      })
    ).map((m) => m.stage);
    assert.ok(stages.includes("BRONZE"), "the bronze match must exist");
    // 6 teams -> 2 zones of 3 -> 6 group matches + semis + bronze + final.
    assert.equal(stages.filter((s) => s === "GROUPS").length, 6);
    assert.equal(etapa.matchCount, 10);
  });

  it("freezes zones once a result is loaded", async () => {
    const etapa = await createEtapa({ name: "Con resultado", teams: teams("H") });
    const match = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "GROUPS" },
    });
    assert.ok(match?.teamAId && match.teamBId);

    // Re-arming the zones is still allowed before any result.
    await generateZones(etapa.id);

    await recordResult({
      matchId: match.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 10 }],
    });

    // After a result, both operations would leave the match in its old zone and
    // silently corrupt the standings, so they must be refused.
    await assert.rejects(() => generateZones(etapa.id), /congelad|jugada/i);
    const team = await prisma.team.findFirst({ where: { etapaId: etapa.id } });
    assert.ok(team);
    await assert.rejects(
      () => swapTeam(team.id, team.zone, team.zone === "A" ? "B" : "A", etapa.id),
      /congelad|jugada/i,
    );
  });

  it("lets the date decide the active etapa and the list order", async () => {
    const january = await createEtapa({
      name: "Enero",
      date: "2026-01-10",
      teams: teams("V"),
      circuit: "INTERMEDIOS",
    });
    const june = await createEtapa({
      name: "Junio",
      date: "2026-06-10",
      teams: teams("N"),
      circuit: "INTERMEDIOS",
    });
    const march = await createEtapa({
      name: "Marzo",
      date: "2026-03-10",
      teams: teams("M"),
      circuit: "INTERMEDIOS",
    });

    assert.equal(
      await resolveEtapaId(null, "INTERMEDIOS"),
      june.id,
      "the newest date wins, not the last one created",
    );

    const list = await listEtapas("INTERMEDIOS");
    const index = (id: string) => list.findIndex((etapa) => etapa.id === id);
    assert.ok(index(january.id) < index(march.id));
    assert.ok(index(march.id) < index(june.id));
  });

  it("deletes a cancelled etapa and refuses any other", async () => {
    const etapa = await createEtapa({
      name: "Para borrar",
      teams: teams("K"),
      circuit: "INTERMEDIOS",
    });

    // An open etapa is refused: it holds a fixture that must not disappear.
    await assert.rejects(() => deleteEtapa(etapa.id), /cancelada/i);

    await prisma.etapa.update({
      where: { id: etapa.id },
      data: { cancelledAt: new Date() },
    });
    await deleteEtapa(etapa.id);

    assert.equal(
      await prisma.etapa.findUnique({ where: { id: etapa.id } }),
      null,
      "the etapa is gone",
    );
    assert.equal(
      await prisma.match.count({ where: { etapaId: etapa.id } }),
      0,
      "its matches are gone with it",
    );
  });

  it("registers a weather-cancelled etapa with no roster or fixture", async () => {
    const before = await prisma.etapa.findMany({
      where: { circuit: "INTERMEDIOS" },
      select: { sortOrder: true },
    });
    const etapa = await createCancelledEtapa({
      name: "Suspendida",
      date: "2026-07-04",
      circuit: "INTERMEDIOS",
    });

    const row = await prisma.etapa.findUnique({ where: { id: etapa.id } });
    assert.ok(row?.cancelledAt, "it is born cancelled");
    assert.equal(row?.name, "Suspendida");
    assert.equal(
      await prisma.match.count({ where: { etapaId: etapa.id } }),
      0,
      "no fixture is generated",
    );
    assert.equal(
      await prisma.team.count({ where: { etapaId: etapa.id } }),
      0,
      "no teams are created",
    );
    assert.equal(
      row?.sortOrder,
      Math.max(0, ...before.map((e) => e.sortOrder)) + 1,
      "it still takes the next number of the circuit",
    );

    const list = await listEtapas("INTERMEDIOS");
    assert.ok(list.some((e) => e.id === etapa.id && e.cancelledAt));

    // Its number can be freed again by deleting it.
    await deleteEtapa(etapa.id);
    assert.equal(await prisma.etapa.findUnique({ where: { id: etapa.id } }), null);
  });

  it("stores the gallery folder per circuit and rejects a bogus link", async () => {
    const FOLDER = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

    assert.equal(await getGalleryFolder("INTERMEDIOS"), null);
    await assert.rejects(
      () => setGalleryFolder("INTERMEDIOS", "no es un link"),
      /carpeta válida/i,
    );

    // The full Drive URL is reduced to the folder id.
    await setGalleryFolder(
      "INTERMEDIOS",
      `https://drive.google.com/drive/u/0/folders/${FOLDER}?usp=sharing`,
    );
    assert.equal(await getGalleryFolder("INTERMEDIOS"), FOLDER);
    assert.equal(
      await getGalleryFolder("PRINCIPIANTES"),
      null,
      "each circuit keeps its own folder",
    );

    // An empty value clears the override.
    await setGalleryFolder("INTERMEDIOS", "");
    assert.equal(await getGalleryFolder("INTERMEDIOS"), null);
  });

  it("applies the etapa set format to every match and validates its caps", async () => {
    const etapa = await createEtapa({
      name: "Intermedios 2 sets",
      teams: teams("F"),
      circuit: "INTERMEDIOS",
      setFormat: "TWO_21_TIEBREAK_15",
    });

    const matches = await prisma.match.findMany({ where: { etapaId: etapa.id } });
    assert.ok(matches.length > 0);
    assert.ok(
      matches.every((m) => m.setFormat === "TWO_21_TIEBREAK_15"),
      "every match of the etapa inherits the chosen format",
    );

    const group = matches.find((m) => m.stage === "GROUPS");
    assert.ok(group);

    // Two sets to 21 and a third to 15: 21-19, 18-21, 15-13 is a valid match.
    await recordResult({
      matchId: group.id,
      setFormat: "TWO_21_TIEBREAK_15",
      sets: [
        { teamA: 21, teamB: 19 },
        { teamA: 18, teamB: 21 },
        { teamA: 15, teamB: 13 },
      ],
    });
    const played = await prisma.match.findUnique({ where: { id: group.id } });
    assert.equal(played?.resultStatus, "COMPLETE");

    // Win by 2 still rules the third set: 15-14 does not close it.
    const another = matches.find((m) => m.stage === "GROUPS" && m.id !== group.id);
    assert.ok(another);
    await assert.rejects(
      () =>
        recordResult({
          matchId: another.id,
          setFormat: "TWO_21_TIEBREAK_15",
          sets: [
            { teamA: 21, teamB: 19 },
            { teamA: 18, teamB: 21 },
            { teamA: 15, teamB: 14 },
          ],
        }),
      /Set 3 is invalid/,
    );
  });
});

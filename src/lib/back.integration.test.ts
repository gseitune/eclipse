import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

/**
 * Integration tests for editResult against a throwaway SQLite database.
 * The REAL prisma adapter/back layer is exercised: guards, recalculations
 * and SSE events. Cost: one `prisma db push` per run.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "selvarena-edit-"));
const dbPath = join(dir, "test.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;

// Loaded inside before(): the prisma/back modules read DATABASE_URL at import,
// so the env override must be in place before the first dynamic import.
type PrismaModule = typeof import("./prisma");
type BackModule = typeof import("./back");
type EventsModule = typeof import("./events");

let prisma!: PrismaModule["prisma"];
let editResult!: BackModule["editResult"];
let recordResult!: BackModule["recordResult"];
let getStandings!: BackModule["getStandings"];
let getNextMatch!: BackModule["getNextMatch"];
let BackError!: BackModule["BackError"];
let subscribeSse!: EventsModule["subscribeSse"];

async function seedTournament() {
  await prisma.team.createMany({
    data: [
      { id: "tA1", name: "Alpha", zone: "A" },
      { id: "tA2", name: "Beta", zone: "A" },
      { id: "tB1", name: "Gamma", zone: "B" },
      { id: "tB2", name: "Delta", zone: "B" },
    ],
  });
  await prisma.match.createMany({
    data: [
      { id: "m1", stage: "GROUPS", zone: "A", slot: 1, timeLabel: "10:00 - 10:20", teamAId: "tA1", teamBId: "tA2" },
      { id: "m2", stage: "GROUPS", zone: "B", slot: 2, timeLabel: "10:20 - 10:40", teamAId: "tB1", teamBId: "tB2" },
      { id: "m3", stage: "SEMIFINAL_1", slot: 3, timeLabel: "16:40 - 17:00" },
      { id: "m4", stage: "SEMIFINAL_2", slot: 4, timeLabel: "17:00 - 17:20" },
      { id: "m5", stage: "FINAL", slot: 5, timeLabel: "18:00 - 18:20" },
    ],
  });
  await prisma.tournamentState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

describe("editResult (integration)", () => {
  before(async () => {
    process.env.DATABASE_URL = dbUrl;
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    editResult = back.editResult;
    recordResult = back.recordResult;
    getStandings = back.getStandings;
    getNextMatch = back.getNextMatch;
    BackError = back.BackError;
    const events = await import("./events");
    subscribeSse = events.subscribeSse;

    await seedTournament();
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("recalculates standings and nextMatch after editing a full score", async () => {
    await recordResult({ matchId: "m1", setAScore: 2, setBScore: 1 });
    let standings = await getStandings();
    assert.equal(standings.A?.[0]?.teamId, "tA1", "Alpha wins zone A");

    // Invert the score → Beta wins zone A.
    await editResult({ matchId: "m1", setAScore: 1, setBScore: 2 });
    standings = await getStandings();
    assert.equal(standings.A?.[0]?.teamId, "tA2", "standings recalculated after edit");
    assert.equal(standings.A?.[1]?.teamId, "tA1");

    const next = await getNextMatch();
    assert.equal(next?.id, "m2", "nextMatch still derives from the pending group match");
  });

  it("fires the same SSE events as a result on edit", async () => {
    const events: string[] = [];
    const off = subscribeSse((e) => events.push(e.type));
    try {
      await editResult({ matchId: "m1", setAScore: 2, setBScore: 1 });
    } finally {
      off();
    }
    assert.ok(events.includes("result-recorded"), "result event fired");
    assert.ok(events.includes("standings-changed"), "standings event fired");
    assert.ok(events.includes("schedule-changed"), "schedule event fired");
  });

  it("blocks editing when a descendant phase played, leaving state intact", async () => {
    // Complete the groups → semis fill, phase ELIMINATORIES.
    await recordResult({ matchId: "m2", setAScore: 2, setBScore: 1 });
    await recordResult({ matchId: "m3", setAScore: 2, setBScore: 1 });
    await recordResult({ matchId: "m4", setAScore: 2, setBScore: 1 });

    await assert.rejects(
      () => editResult({ matchId: "m1", setAScore: 1, setBScore: 2 }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "editing_blocks_bracket",
    );

    const m1 = await prisma.match.findUnique({ where: { id: "m1" } });
    assert.equal(m1?.setAScore, 2, "score untouched");
    assert.equal(m1?.setBScore, 1, "score untouched");
    assert.equal(m1?.winnerId, "tA1", "winner untouched");
  });

  it("rejects editing a match without a result", async () => {
    // FINAL is still pending.
    await assert.rejects(
      () => editResult({ matchId: "m5", setAScore: 2, setBScore: 1 }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "no_result_to_edit",
    );
  });

  it("allows editing a semifinal while the final is pending", async () => {
    await editResult({ matchId: "m3", setAScore: 1, setBScore: 2 });
    const m3 = await prisma.match.findUnique({ where: { id: "m3" } });
    assert.equal(m3?.setAScore, 1);
    assert.equal(m3?.setBScore, 2);
    assert.equal(m3?.resultStatus, "COMPLETE");
  });

  it("blocks editing a semifinal once the final played", async () => {
    await prisma.match.update({
      where: { id: "m5" },
      data: { teamAId: "tA1", teamBId: "tB1" },
    });
    await recordResult({ matchId: "m5", setAScore: 2, setBScore: 1 });

    await assert.rejects(
      () => editResult({ matchId: "m3", setAScore: 1, setBScore: 2 }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "editing_blocks_bracket",
    );
  });
});
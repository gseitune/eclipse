import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

/**
 * Integration tests for recordResult/editResult against a throwaway SQLite
 * database. The REAL prisma adapter/back layer is exercised: guards,
 * recalculations, multi-set persistence and SSE events.
 * Cost: one `prisma db push` per run.
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
type ResultFormatModule = typeof import("./result-format");

let prisma!: PrismaModule["prisma"];
let editResult!: BackModule["editResult"];
let recordResult!: BackModule["recordResult"];
let getStandings!: BackModule["getStandings"];
let getNextMatch!: BackModule["getNextMatch"];
let BackError!: BackModule["BackError"];
let InvalidResultError!: ResultFormatModule["InvalidResultError"];
let subscribeSse!: EventsModule["subscribeSse"];
let etapaId = "";

async function seedTournament() {
  const etapa = await prisma.etapa.create({
    data: { name: "Test etapa", sortOrder: 1 },
  });
  etapaId = etapa.id;
  await prisma.team.createMany({
    data: [
      { id: "tA1", etapaId, name: "Alpha", zone: "A" },
      { id: "tA2", etapaId, name: "Beta", zone: "A" },
      { id: "tB1", etapaId, name: "Gamma", zone: "B" },
      { id: "tB2", etapaId, name: "Delta", zone: "B" },
    ],
  });
  await prisma.match.createMany({
    data: [
      { id: "m1", etapaId, stage: "GROUPS", zone: "A", slot: 1, timeLabel: "10:00 - 10:20", teamAId: "tA1", teamBId: "tA2" },
      { id: "m2", etapaId, stage: "GROUPS", zone: "B", slot: 2, timeLabel: "10:20 - 10:40", teamAId: "tB1", teamBId: "tB2" },
      { id: "m3", etapaId, stage: "SEMIFINAL_1", slot: 3, timeLabel: "16:40 - 17:00" },
      { id: "m4", etapaId, stage: "SEMIFINAL_2", slot: 4, timeLabel: "17:00 - 17:20" },
      { id: "m5", etapaId, stage: "FINAL", slot: 5, timeLabel: "18:00 - 18:20" },
    ],
  });
  await prisma.tournamentState.create({ data: { etapaId } });
}

function bad400(fn: () => Promise<unknown>, reason?: string) {
  return assert.rejects(
    () => fn(),
    (err: unknown) => {
      assert.ok(err instanceof InvalidResultError, `expected InvalidResultError, got ${err}`);
      assert.equal(err.status, 400);
      if (reason) assert.equal(err.reason, reason);
      return true;
    },
  );
}

describe("recordResult/editResult (integration)", () => {
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
    const input = await import("./result-format");
    InvalidResultError = input.InvalidResultError;
    const events = await import("./events");
    subscribeSse = events.subscribeSse;

    await seedTournament();
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("records/edits a single-set group result (win-by-2) and recalculates standings", async () => {
    await recordResult({ matchId: "m1", setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 19 }] });
    let standings = await getStandings();
    assert.equal(standings.A?.[0]?.teamId, "tA1", "Alpha wins zone A");
    assert.equal(standings.A?.[0]?.setDiff, 1, "single-set diff is 1 for the winner");

    // Over-cap win-by-2 score is valid (22-20) and the same validation path
    // accepts it on edit.
    await editResult({ matchId: "m1", setFormat: "SINGLE_21", sets: [{ teamA: 22, teamB: 20 }] });
    let m1 = await prisma.match.findUnique({ where: { id: "m1" } });
    assert.deepEqual(m1?.sets, [{ teamA: 22, teamB: 20 }], "sets persisted as JSON");
    assert.equal(m1?.setFormat, "SINGLE_21");
    assert.equal(m1?.resultStatus, "COMPLETE");

    // Invert the score → Beta wins zone A.
    await editResult({ matchId: "m1", setFormat: "SINGLE_21", sets: [{ teamA: 19, teamB: 21 }] });
    standings = await getStandings();
    assert.equal(standings.A?.[0]?.teamId, "tA2", "standings recalculated after edit");
    assert.equal(standings.A?.[1]?.teamId, "tA1");

    const next = await getNextMatch();
    assert.equal(next?.id, "m2", "nextMatch still derives from the pending group match");
    m1 = await prisma.match.findUnique({ where: { id: "m1" } });
    assert.deepEqual(m1?.sets, [{ teamA: 19, teamB: 21 }], "inverted score persisted");
  });

  it("rejects 21-20 (win by 2) on record, sharing the same validation as edit", async () => {
    await bad400(
      () => recordResult({ matchId: "m2", setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 20 }] }),
      "invalid_set_score",
    );
    assert.equal((await prisma.match.findUnique({ where: { id: "m2" } }))?.resultStatus, "PENDING");

    await bad400(
      () => recordResult({ matchId: "m2", setFormat: "TWO_15_TIEBREAK", sets: [] }),
      "format_not_allowed_for_stage",
    );
  });

  it("records a WINNER_ONLY result in groups (allowed in every stage) and finalizes the bracket", async () => {
    await recordResult({ matchId: "m2", winnerId: "tB1" });
    const m2 = await prisma.match.findUnique({ where: { id: "m2" } });
    assert.equal(m2?.resultStatus, "WINNER_ONLY");
    assert.equal(m2?.sets, null, "no invented sets");
    assert.equal(m2?.winnerId, "tB1");

    const state = await prisma.tournamentState.findUnique({ where: { etapaId } });
    assert.equal(state?.phase, "ELIMINATORIES", "both group results build the bracket");
    const m3 = await prisma.match.findUnique({ where: { id: "m3" } });
    assert.ok(m3?.teamAId && m3?.teamBId, "semi slot filled");
  });

  it("fires the same SSE events as a result on edit", async () => {
    const events: string[] = [];
    const off = subscribeSse((e) => events.push(e.type));
    try {
      await editResult({ matchId: "m1", setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 19 }] });
    } finally {
      off();
    }
    assert.ok(events.includes("result-recorded"), "result event fired");
    assert.ok(events.includes("standings-changed"), "standings event fired");
    assert.ok(events.includes("schedule-changed"), "schedule event fired");
  });

  it("records semis as 2x15: 2-set sweep valid, 15-14 and 1-1-without-set-3 rejected", async () => {
    await bad400(
      () =>
        recordResult({
          matchId: "m3",
          setFormat: "TWO_15_TIEBREAK",
          sets: [
            { teamA: 15, teamB: 14 },
            { teamA: 16, teamB: 14 },
          ],
        }),
      "invalid_set_score",
    );

    await bad400(
      () =>
        recordResult({
          matchId: "m3",
          setFormat: "TWO_15_TIEBREAK",
          sets: [
            { teamA: 15, teamB: 13 },
            { teamA: 13, teamB: 15 },
          ],
        }),
      "third_set_required",
    );

    await recordResult({
      matchId: "m3",
      setFormat: "TWO_15_TIEBREAK",
      sets: [
        { teamA: 15, teamB: 13 },
        { teamA: 16, teamB: 14 },
      ],
    });
    const m3 = await prisma.match.findUnique({ where: { id: "m3" } });
    assert.deepEqual(m3?.sets, [
      { teamA: 15, teamB: 13 },
      { teamA: 16, teamB: 14 },
    ]);
    assert.equal(m3?.winnerId, "tA1", "winner derived from the 2-0 sweep (A1 from zone A)");
  });

  it("records a semi decided by the mandatory third set (1-1 + 15)", async () => {
    await recordResult({
      matchId: "m4",
      setFormat: "TWO_15_TIEBREAK",
      sets: [
        { teamA: 15, teamB: 11 },
        { teamA: 13, teamB: 15 },
        { teamA: 15, teamB: 12 },
      ],
    });
    const m4 = await prisma.match.findUnique({ where: { id: "m4" } });
    assert.equal(Array.isArray(m4?.sets) ? m4.sets.length : -1, 3);
    assert.equal(m4?.winnerId, "tB1", "winner derived from the 2-1 set score");
  });

  it("blocks editing when a descendant phase played, leaving state intact", async () => {
    await assert.rejects(
      () => editResult({ matchId: "m1", setFormat: "SINGLE_21", sets: [{ teamA: 19, teamB: 21 }] }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "editing_blocks_bracket",
    );

    const m1 = await prisma.match.findUnique({ where: { id: "m1" } });
    assert.deepEqual(m1?.sets, [{ teamA: 21, teamB: 19 }], "score untouched");
    assert.equal(m1?.winnerId, "tA1", "winner untouched");
  });

  it("rejects editing a match without a result", async () => {
    // FINAL is still pending.
    await assert.rejects(
      () => editResult({ matchId: "m5", setFormat: "BEST_OF_3_21", sets: [{ teamA: 21, teamB: 18 }] }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "no_result_to_edit",
    );
  });

  it("allows editing a multi-set semi while the final is pending", async () => {
    await editResult({
      matchId: "m3",
      setFormat: "TWO_15_TIEBREAK",
      sets: [
        { teamA: 13, teamB: 15 },
        { teamA: 14, teamB: 16 },
      ],
    });
    const m3 = await prisma.match.findUnique({ where: { id: "m3" } });
    assert.deepEqual(m3?.sets, [
      { teamA: 13, teamB: 15 },
      { teamA: 14, teamB: 16 },
    ]);
    assert.equal(m3?.resultStatus, "COMPLETE");
    assert.equal(m3?.winnerId, "tB2", "multi-set edit re-derives the winner");
  });

  it("records the final as BEST_OF_3_21: WINNER_ONLY first, 4/1-set and post-sweep rejections, sweep ok", async () => {
    await prisma.match.update({
      where: { id: "m5" },
      data: { teamAId: "tA1", teamBId: "tB1" },
    });

    // Quick capture first (WINNER_ONLY legal in the final too).
    await recordResult({ matchId: "m5", winnerId: "tA1" });
    const quick = await prisma.match.findUnique({ where: { id: "m5" } });
    assert.equal(quick?.resultStatus, "WINNER_ONLY");

    // The fix flow edits it into a full score later — all rejections first.
    await bad400(
      () =>
        editResult({
          matchId: "m5",
          setFormat: "BEST_OF_3_21",
          sets: [
            { teamA: 21, teamB: 18 },
            { teamA: 19, teamB: 21 },
            { teamA: 21, teamB: 17 },
            { teamA: 21, teamB: 19 },
          ],
        }),
      "invalid_set_count",
    );
    await bad400(
      () =>
        editResult({
          matchId: "m5",
          setFormat: "BEST_OF_3_21",
          sets: [{ teamA: 21, teamB: 18 }],
        }),
      "invalid_set_count",
    );
    await bad400(
      () =>
        editResult({
          matchId: "m5",
          setFormat: "BEST_OF_3_21",
          sets: [
            { teamA: 21, teamB: 18 },
            { teamA: 21, teamB: 19 },
            { teamA: 15, teamB: 21 },
          ],
        }),
      "match_already_decided",
    );

    await editResult({
      matchId: "m5",
      setFormat: "BEST_OF_3_21",
      sets: [
        { teamA: 21, teamB: 18 },
        { teamA: 22, teamB: 20 },
      ],
    });
    const m5 = await prisma.match.findUnique({ where: { id: "m5" } });
    assert.deepEqual(m5?.sets, [
      { teamA: 21, teamB: 18 },
      { teamA: 22, teamB: 20 },
    ]);
    assert.equal(m5?.winnerId, "tA1", "2-0 sweep decides the final");
  });

  it("blocks editing a semifinal once the final played", async () => {
    await assert.rejects(
      () => editResult({ matchId: "m3", setFormat: "TWO_15_TIEBREAK", sets: [{ teamA: 15, teamB: 13 }] }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "editing_blocks_bracket",
    );
  });
});
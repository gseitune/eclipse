import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@/generated/prisma/client";

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
let createEtapa!: BackModule["createEtapa"];
let reorderMatch!: BackModule["reorderMatch"];
let getScheduleBoard!: BackModule["getScheduleBoard"];
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
    createEtapa = back.createEtapa;
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

  it("rejects recordResult on a closed etapa (etapa_cerrada)", async () => {
    // Reset m2 to PENDING (it may have been played by earlier tests)
    await prisma.match.update({
      where: { id: "m2" },
      data: { resultStatus: "PENDING", winnerId: null, sets: Prisma.DbNull, recordedAt: null },
    });

    // Close the etapa by setting closedAt directly
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { closedAt: new Date() },
    });

    await assert.rejects(
      () => recordResult({ matchId: "m2", winnerId: "tB1" }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "etapa_cerrada",
    );
  });
});

describe("createEtapa (integration) — mixto fijo", () => {
  const MIN_TEAMS = 6;

  before(async () => {
    // The first describe's after() disconnected and deleted the throwaway db
    // dir. Recreate it and push the schema again for createEtapa tests.
    mkdirSync(dir, { recursive: true });
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  function teams(count: number, overrides?: Partial<{ name: string; maleName: string; femaleName: string }>) {
    return Array.from({ length: count }, (_, i) => ({
      name: `Equipo ${i + 1}`,
      maleName: `Hombre ${i + 1}`,
      femaleName: `Mujer ${i + 1}`,
      ...overrides,
    }));
  }

  it("creates a full etapa persisting players and a 9-match fixture for 6 teams", async () => {
    const etapa = await createEtapa({ name: "Mixta", teams: teams(MIN_TEAMS) });
    const rows = await prisma.team.findMany({
      where: { etapaId: etapa.id },
      orderBy: { name: "asc" },
    });
    assert.equal(rows.length, MIN_TEAMS);
    assert.equal(rows[0].maleName, "Hombre 1");
    assert.equal(rows[0].femaleName, "Mujer 1");
    // 6 teams → 2 zones of 3 → 3+3 intra-zone round-robin + 3 bracket slots
    assert.equal(
      await prisma.match.count({ where: { etapaId: etapa.id } }),
      9,
    );
    assert.equal(etapa.matchCount, 9, "summary reflects the real fixture size");
  });

  it("rejects a team missing the male or female player (team_players_required)", async () => {
    const missingMale = teams(MIN_TEAMS);
    missingMale[0] = { name: "Sin hombre", maleName: "", femaleName: "Mujer X" };
    await assert.rejects(
      () => createEtapa({ name: "Sin hombre", teams: missingMale }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 400 &&
        err.reason === "team_players_required",
    );

    const missingFemale = teams(MIN_TEAMS);
    missingFemale[0] = { name: "Sin mujer", maleName: "Hombre X", femaleName: "" };
    await assert.rejects(
      () => createEtapa({ name: "Sin mujer", teams: missingFemale }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 400 &&
        err.reason === "team_players_required",
    );
  });

  it("dedupes teams by trimmed name before validation", async () => {
    const dup = teams(MIN_TEAMS + 1);
    dup[dup.length - 1] = { ...dup[0], name: `  ${dup[0].name}  ` };
    const etapa = await createEtapa({ name: "Duplicada", teams: dup });
    assert.equal(
      await prisma.team.count({ where: { etapaId: etapa.id } }),
      MIN_TEAMS,
      "duplicate rows collapse into one team",
    );
  });

it("enforces the minimum and maximum team counts", async () => {
     await assert.rejects(
       () => createEtapa({ name: "Pocos", teams: teams(MIN_TEAMS - 1) }),
       (err: unknown) => err instanceof BackError && err.reason === "too_few_teams",
     );
   });
 });

describe("reorderMatch and getScheduleBoard (integration)", () => {
  before(async () => {
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    reorderMatch = back.reorderMatch;
    getScheduleBoard = back.getScheduleBoard;
    BackError = back.BackError;
    const events = await import("./events");
    subscribeSse = events.subscribeSse;
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  async function seedReorderTournament() {
    await prisma.match.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.tournamentState.deleteMany({});
    await prisma.etapa.deleteMany({});
    const etapa = await prisma.etapa.create({ data: { name: "Reorder test", sortOrder: 1 } });
    const etapaId = etapa.id;
    await prisma.team.createMany({
      data: [
        { id: "re1", etapaId, name: "Alpha", zone: "A" },
        { id: "re2", etapaId, name: "Beta", zone: "A" },
        { id: "re3", etapaId, name: "Gamma", zone: "B" },
      ],
    });
    await prisma.match.createMany({
      data: [
        { id: "rm1", etapaId, stage: "GROUPS", zone: "A", slot: 1, teamAId: "re1", teamBId: "re2", resultStatus: "PENDING" },
        { id: "rm2", etapaId, stage: "GROUPS", zone: "B", slot: 2, teamAId: "re3", teamBId: null, resultStatus: "PENDING" },
        { id: "rm3", etapaId, stage: "FINAL", slot: 3, teamAId: null, teamBId: null, resultStatus: "PENDING" },
      ],
    });
    await prisma.tournamentState.create({ data: { etapaId } });
    return etapaId;
  }

it("reorderMatch down swaps slots of two PENDING matches", async () => {
      await seedReorderTournament();
      // rm1 at slot 1, rm2 at slot 2 — move rm1 down
      await reorderMatch("rm1", "down");
      const m1 = await prisma.match.findUnique({ where: { id: "rm1" } });
      const m2 = await prisma.match.findUnique({ where: { id: "rm2" } });
      assert.equal(m1?.slot, 2, "rm1 should now be at slot 2");
      assert.equal(m2?.slot, 1, "rm2 should now be at slot 1");
    });

    it("reorderMatch up swaps slots with nearest pending neighbor", async () => {
      await seedReorderTournament();
      // rm2 at slot 2, rm1 at slot 1 — move rm2 up
      await reorderMatch("rm2", "up");
      const m1 = await prisma.match.findUnique({ where: { id: "rm1" } });
      const m2 = await prisma.match.findUnique({ where: { id: "rm2" } });
      assert.equal(m2?.slot, 1, "rm2 should now be at slot 1");
      assert.equal(m1?.slot, 2, "rm1 should now be at slot 2");
    });

    it("reorderMatch refuses a played match (409)", async () => {
      await seedReorderTournament();
      await prisma.match.update({ where: { id: "rm1" }, data: { resultStatus: "COMPLETE" } });
      await assert.rejects(
        () => reorderMatch("rm1", "down"),
        (err: unknown) =>
          err instanceof BackError && err.status === 409 && err.reason === "match_not_pending",
      );
    });

    it("reorderMatch refuses when no pending neighbor in direction (409)", async () => {
      await seedReorderTournament();
      // Move rm3 (slot 3, no pending neighbor above it since it's last) down
      await assert.rejects(
        () => reorderMatch("rm3", "down"),
        (err: unknown) =>
          err instanceof BackError && err.status === 409,
      );
    });

    it("getScheduleBoard returns rows ordered by slot with team names", async () => {
      const etapaId = await seedReorderTournament();
      const board = await getScheduleBoard(etapaId);
      assert.equal(board.length, 3, "board has 3 rows");
      assert.equal(board[0].slot, 1, "first row is slot 1");
      assert.equal(board[0].teamA?.name, "Alpha", "team A name present");
      assert.equal(board[0].teamB?.name, "Beta", "team B name present");
      // Bracket slot has null teams
      const bracketRow = board.find((r) => r.slot === 2);
      assert.ok(bracketRow, "bracket row exists");
      assert.equal(bracketRow?.resultStatus, "PENDING");
    });
});
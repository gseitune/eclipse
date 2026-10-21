import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Prisma, type Stage } from "@/generated/prisma/client";

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

// The integration suite MUST never touch a real database. Force the
// throwaway URL at module scope so ANY import of ./prisma (the before hook
// included, even under unusual test invocations) binds to the temp file and
// never to DATABASE_URL/TURSO_DATABASE_URL inherited from the parent shell.
process.env.DATABASE_URL = dbUrl;
process.env.TURSO_DATABASE_URL = "";
process.env.DATABASE_AUTH_TOKEN = "";

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
let reconcileEliminatories!: BackModule["reconcileEliminatories"];
let createEtapa!: BackModule["createEtapa"];
let reorderMatch!: BackModule["reorderMatch"];
let getScheduleBoard!: BackModule["getScheduleBoard"];
let getTeamsByZone!: BackModule["getTeamsByZone"];
let getBracketsSnapshot!: BackModule["getBracketsSnapshot"];
let generateZones!: BackModule["generateZones"];
let listEtapas!: BackModule["listEtapas"];
let updateEtapaMeta!: BackModule["updateEtapaMeta"];
let getState!: BackModule["getState"];
let getStateSnapshot!: BackModule["getStateSnapshot"];
let resolveBestThird!: BackModule["resolveBestThird"];
let createBestThirdDesempate!: BackModule["createBestThirdDesempate"];
let reslotGroupSchedule!: BackModule["reslotGroupSchedule"];
let BackError!: BackModule["BackError"];
let InvalidResultError!: ResultFormatModule["InvalidResultError"];
let subscribeSse!: EventsModule["subscribeSse"];
let etapaId = "";
let metaEtapaId = "";

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

  it("a correction that keeps the winner does not clear the descendant chain", async () => {
    const fetchSemis = () =>
      prisma.match.findMany({
        where: { etapaId, stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2"] } },
        select: { id: true, resultStatus: true, sets: true, winnerId: true },
        orderBy: { id: "asc" },
      });

    const before = await fetchSemis();
    assert.ok(
      before.every((m) => m.resultStatus !== "PENDING"),
      "fixture precondition: the semis are already played",
    );

    // 21-19 -> 22-20 keeps Alpha as the winner, so no descendant is invalidated
    // even though the caller passes cascade: true.
    await editResult({
      matchId: "m1",
      setFormat: "SINGLE_21",
      sets: [{ teamA: 22, teamB: 20 }],
      cascade: true,
    });

    assert.deepEqual(
      await fetchSemis(),
      before,
      "descendant results must survive a winner-preserving correction",
    );
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
    // 6 teams → 2 zones of 3 → 3+3 intra-zone round-robin + 4 bracket slots
    // (two semis, the always-played third-place match and the final).
    assert.equal(
      await prisma.match.count({ where: { etapaId: etapa.id } }),
      10,
    );
    assert.equal(etapa.matchCount, 10, "summary reflects the real fixture size");
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

  it("canonicalizes whitelisted player aliases so a variant does not open a second team", async () => {
    const etapa = await createEtapa({
      name: "Alias",
      teams: [
        ...teams(MIN_TEAMS - 1),
        { name: "Seba y Liz", maleName: "Seba", femaleName: "Liz" },
        { name: "Sebita y Liz", maleName: "Sebita", femaleName: "Liz" },
      ],
    });
    const rows = await prisma.team.findMany({ where: { etapaId: etapa.id } });
    const liz = rows.filter((t) => t.femaleName === "Liz");
    assert.equal(liz.length, 1, "Sebita y Liz collapses into the canonical Seba y Liz");
    assert.equal(liz[0].name, "Seba y Liz", "the confirmed name wins");
    assert.equal(liz[0].maleName, "Seba", "the alias is rewritten on the player too");
  });

  it("keeps similar but different names apart (Cami vs CamiC)", async () => {
    const etapa = await createEtapa({
      name: "Sin falso merge",
      teams: [
        ...teams(MIN_TEAMS - 2),
        { name: "Cami y Juan", maleName: "Juan", femaleName: "Cami" },
        { name: "CamiC y Juan", maleName: "Juan", femaleName: "CamiC" },
      ],
    });
    const rows = await prisma.team.findMany({ where: { etapaId: etapa.id } });
    assert.equal(rows.length, MIN_TEAMS, "both players survive as separate teams");
    assert.ok(rows.some((t) => t.name === "Cami y Juan"), "Cami keeps its exact name");
    assert.ok(rows.some((t) => t.name === "CamiC y Juan"), "CamiC keeps its exact name");
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

/**
 * Cancel (weather suspension) integration tests.
 * Verifies that once an etapa is cancelled via cancelledAt:
 * - recordResult/editResult throw etapa_cancelled
 * - requireEtapaOpen blocks all modifications (tested indirectly)
 */
describe("cancel etapa (integration) — weather suspension", () => {
  before(async () => {
    // The previous describe's after() deleted the throwaway db dir.
    // Recreate it and push the schema again.
    mkdirSync(dir, { recursive: true });
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    recordResult = back.recordResult;
    editResult = back.editResult;
    reorderMatch = back.reorderMatch;
    generateZones = back.generateZones;
    listEtapas = back.listEtapas;
    getState = back.getState;
    getStateSnapshot = back.getStateSnapshot;
    resolveBestThird = back.resolveBestThird;
    BackError = back.BackError;
    const events = await import("./events");
    subscribeSse = events.subscribeSse;

    // Create a fresh etapa with teams and a match so we can test cancellation.
    const etapa = await prisma.etapa.create({
      data: { name: "Cancel test etapa", sortOrder: 1 },
    });
    etapaId = etapa.id;
    await prisma.team.createMany({
      data: [
        { id: "cA1", etapaId, name: "TeamA", zone: "A" },
        { id: "cA2", etapaId, name: "TeamB", zone: "A" },
        { id: "cB1", etapaId, name: "TeamC", zone: "B" },
        { id: "cB2", etapaId, name: "TeamD", zone: "B" },
      ],
    });
    await prisma.match.createMany({
      data: [
        { id: "cm1", etapaId, stage: "GROUPS", zone: "A", slot: 1, teamAId: "cA1", teamBId: "cA2", resultStatus: "PENDING" },
        { id: "cm2", etapaId, stage: "SEMIFINAL_1", slot: 2, teamAId: null, teamBId: null, resultStatus: "PENDING" },
        { id: "cm3", etapaId, stage: "GROUPS", zone: "B", slot: 3, teamAId: "cB1", teamBId: "cB2", resultStatus: "PENDING" },
        { id: "cm4", etapaId, stage: "GROUPS", zone: "B", slot: 4, teamAId: "cB2", teamBId: "cB1", resultStatus: "PENDING" },
      ],
    });
    await prisma.tournamentState.create({ data: { etapaId } });
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects recordResult on a cancelled etapa (etapa_cancelled)", async () => {
    // Cancel the etapa by setting cancelledAt directly
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { cancelledAt: new Date() },
    });

    await assert.rejects(
      () => recordResult({ matchId: "cm1", winnerId: "cA1" }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "etapa_cancelled",
    );
  });

  it("rejects editResult on a cancelled etapa (etapa_cancelled)", async () => {
    // Reset the match to have a result so editResult can reach requireEtapaOpen
    await prisma.match.update({
      where: { id: "cm1" },
      data: { resultStatus: "COMPLETE", winnerId: "cA1", sets: [{ teamA: 21, teamB: 19 }] },
    });

    await assert.rejects(
      () => editResult({ matchId: "cm1", setFormat: "SINGLE_21", sets: [{ teamA: 22, teamB: 20 }] }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "etapa_cancelled",
    );
  });

it("etapa cancelled shows cancelledAt set", async () => {
     const e = await prisma.etapa.findUnique({ where: { id: etapaId } });
     assert.ok(e?.cancelledAt, "cancelledAt should be set");
   });

it("rejects reorderMatch on a cancelled etapa (etapa_cancelled)", async () => {
    // cm3 is a pending group match in the cancelled etapa
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { cancelledAt: new Date() },
    });

    await assert.rejects(
      () => reorderMatch("cm3", "down"),
       (err: unknown) =>
         err instanceof BackError &&
         err.status === 409 &&
         err.reason === "etapa_cancelled",
     );
   });

   it("rejects generateZones on a cancelled etapa (etapa_cancelled)", async () => {
     await prisma.etapa.update({
       where: { id: etapaId },
       data: { cancelledAt: new Date() },
     });

     await assert.rejects(
       () => generateZones(etapaId),
       (err: unknown) =>
         err instanceof BackError &&
         err.status === 409 &&
         err.reason === "etapa_cancelled",
     );
   });

   it("listEtapas returns cancelledAt for each etapa", async () => {
     const etapas = await listEtapas();
     const target = etapas.find((e) => e.id === etapaId);
     assert.ok(target, "etapa should be in list");
     assert.ok(target!.cancelledAt !== null, "cancelledAt should be non-null for cancelled etapa");
   });

it("blocks recordResult after double-cancel (etapa_cancelled persists)", async () => {
    // Already cancelled from a previous test; verify recordResult still blocked
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { cancelledAt: new Date() }, // already set, idempotent
    });

    await assert.rejects(
      () => recordResult({ matchId: "cm3", winnerId: "cB1" }),
       (err: unknown) =>
         err instanceof BackError &&
         err.status === 409 &&
         err.reason === "etapa_cancelled",
     );
   });
 });

/**
 * Etapa metadata CRUD: only name/date, and only while the etapa is neither
 * closed/cancelled nor played. The roster is never editable through this path:
 * a team loaded into an etapa is frozen, and teams only change between etapas.
 */
describe("updateEtapaMeta (integration) - edit name/date of unplayed etapas", () => {
  before(async () => {
    mkdirSync(dir, { recursive: true });
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    updateEtapaMeta = back.updateEtapaMeta;
    listEtapas = back.listEtapas;
    BackError = back.BackError;

    const etapa = await prisma.etapa.create({
      data: { name: "Etapa sin jugar", sortOrder: 1 },
    });
    metaEtapaId = etapa.id;
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("renames an unplayed etapa and persists the trimmed name and the date", async () => {
    const updated = await updateEtapaMeta(metaEtapaId, {
      name: "  Etapa renombrada  ",
      date: "2026-11-07",
    });
    assert.equal(updated.name, "Etapa renombrada");
    assert.equal(updated.played, false, "no result yet: the etapa is not played");

    const row = await prisma.etapa.findUnique({ where: { id: metaEtapaId } });
    assert.equal(row?.name, "Etapa renombrada");
    assert.equal(row?.date?.toISOString().slice(0, 10), "2026-11-07");
  });

  it("clears the date when null is sent", async () => {
    const updated = await updateEtapaMeta(metaEtapaId, { date: null });
    assert.equal(updated.date, null);
  });

  it("rejects a blank name (name_required)", async () => {
    await assert.rejects(
      () => updateEtapaMeta(metaEtapaId, { name: "   " }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 400 &&
        err.reason === "name_required",
    );
  });

  it("rejects any field other than name/date: the roster can never be edited (field_not_editable)", async () => {
    await assert.rejects(
      () =>
        updateEtapaMeta(metaEtapaId, { name: "Nope", teams: [] } as unknown as {
          name?: string;
        }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 400 &&
        err.reason === "field_not_editable",
    );
  });

  it("freezes the etapa once a result is recorded (etapa_jugada)", async () => {
    await prisma.match.create({
      data: {
        id: "meta-m1",
        etapaId: metaEtapaId,
        stage: "GROUPS",
        zone: "A",
        slot: 1,
        resultStatus: "COMPLETE",
      },
    });

    await assert.rejects(
      () => updateEtapaMeta(metaEtapaId, { name: "Ya jugada" }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "etapa_jugada",
    );
  });

  it("reports played:true in listEtapas once the etapa has a result", async () => {
    const etapas = await listEtapas();
    const target = etapas.find((e) => e.id === metaEtapaId);
    assert.ok(target, "etapa should be listed");
    assert.equal(target!.played, true);
  });

  it("keeps rejecting after the etapa is closed (etapa_cerrada)", async () => {
    await prisma.etapa.update({
      where: { id: metaEtapaId },
      data: { closedAt: new Date() },
    });

    await assert.rejects(
      () => updateEtapaMeta(metaEtapaId, { name: "Cerrada" }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "etapa_cerrada",
    );
  });
});

/**
 * CUARTOS format integration tests.
 * Tests etapa creation and key CUARTOS format properties.
 */
describe("CUARTOS format (integration)", () => {
  before(async () => {
    mkdirSync(dir, { recursive: true });
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    createEtapa = back.createEtapa;
    getBracketsSnapshot = back.getBracketsSnapshot;
    getTeamsByZone = back.getTeamsByZone;
    BackError = back.BackError;
    recordResult = back.recordResult;
    getStateSnapshot = back.getStateSnapshot;
    resolveBestThird = back.resolveBestThird;
    createBestThirdDesempate = back.createBestThirdDesempate;
    reslotGroupSchedule = back.reslotGroupSchedule;
    getNextMatch = back.getNextMatch;
    reconcileEliminatories = back.reconcileEliminatories;
    const events = await import("./events");
    subscribeSse = events.subscribeSse;
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates CUARTOS etapa with 11 teams, 9 bracket slots including BRONZE", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Eq${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `Male${i + 1}`,
      femaleName: `Female${i + 1}`,
    }));

    const etapa = await createEtapa({ name: "Cuartos Test", teams, bracketFormat: "CUARTOS" });
    assert.equal(etapa.teamCount, 11);
    assert.equal(etapa.matchCount, 15 + 9, "15 group matches + 9 bracket slots");

    const snapshot = await getBracketsSnapshot(etapa.id);
    const stages = snapshot.map((m) => m.stage);
    assert.ok(stages.includes("BRONZE"), "BRONZE match exists for CUARTOS format");
    assert.ok(stages.includes("REPECHAJE_1"), "REPECHAJE_1 exists");
    assert.ok(stages.includes("CUARTOS_1"), "CUARTOS_1 exists");
    assert.ok(stages.includes("CUARTOS_2"), "CUARTOS_2 exists");
    assert.ok(stages.includes("CUARTOS_3"), "CUARTOS_3 exists");
    assert.ok(stages.includes("CUARTOS_4"), "CUARTOS_4 exists");
    assert.ok(stages.includes("SEMIFINAL_1"), "SEMIFINAL_1 exists");
    assert.ok(stages.includes("SEMIFINAL_2"), "SEMIFINAL_2 exists");
    assert.ok(stages.includes("FINAL"), "FINAL exists");
  });

  it("CUARTOS fills BRONZE with semifinal losers and FINAL with winners", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Eq${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `Male${i + 1}`,
      femaleName: `Female${i + 1}`,
    }));

    // rng=()=>0 produces zones A=4 (Eq1-4), B=3 (Eq5-7), C=4 (Eq8-11)
    let counter = 0;
    const rng = () => { counter += 1; return (counter * 0.5) % 1; };
    const etapa = await createEtapa({ name: "Cuartos Test 2", teams, bracketFormat: "CUARTOS" }, { rng });

    const teamsByZone = await getTeamsByZone(etapa.id);
    const zoneA = teamsByZone.A.map((t) => t.id);
    const zoneB = teamsByZone.B.map((t) => t.id);
    const zoneC = teamsByZone.C.map((t) => t.id);
    // 11 teams over 3 balanced zones: 4/3/4. Assert it so a change in
    // distributeTeams fails here instead of silently breaking the bracket.
    assert.deepEqual([zoneA.length, zoneB.length, zoneC.length], [4, 3, 4]);

    // Record all 15 group results. Every zone third loses its two matches vs
    // the top 2 by the same 19-21, so Andi's points rule (wins -> point
    // difference -> points for, restricted to the zone's top 2) ties the three
    // thirds and the bracket waits for the organizer to pick one.
    const allGroupMatches = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: "GROUPS" },
      orderBy: { slot: "asc" },
    });

    // Intended finishing order per zone: index 0 = champion, 2 = third.
    // Every group match is decided in favour of the better-ranked team, and the
    // score is placed on the correct side (teamA/teamB) so the outcome does not
    // depend on the round-robin slot orientation.
    const zoneOrder: readonly (readonly string[])[] = [zoneA, zoneB, zoneC];
    const rankOf = (id: string) => {
      for (const list of zoneOrder) {
        const i = list.indexOf(id);
        if (i >= 0) return i;
      }
      return Number.MAX_SAFE_INTEGER;
    };

    for (const m of allGroupMatches) {
      const teamAId = m.teamAId!;
      const teamBId = m.teamBId!;
      const isA3VsA4 = (teamAId === zoneA[2] && teamBId === zoneA[3]) || (teamAId === zoneA[3] && teamBId === zoneA[2]);
      const isC3VsC4 = (teamAId === zoneC[2] && teamBId === zoneC[3]) || (teamAId === zoneC[3] && teamBId === zoneC[2]);
      if (isA3VsA4) {
        // A3 vs A4 is NOT counted by the restricted rule (A4 is not top-2);
        // any decided score keeps A3 in 3rd place.
        const aWins = zoneA[2] === teamAId;
        await recordResult({ matchId: m.id, setFormat: "SINGLE_21", sets: [{ teamA: aWins ? 21 : 5, teamB: aWins ? 5 : 21 }] });
      } else if (isC3VsC4) {
        const cWins = zoneC[2] === teamAId;
        await recordResult({ matchId: m.id, setFormat: "SINGLE_21", sets: [{ teamA: cWins ? 21 : 19, teamB: cWins ? 19 : 21 }] });
      } else {
        const aWins = rankOf(teamAId) <= rankOf(teamBId);
        await recordResult({ matchId: m.id, setFormat: "SINGLE_21", sets: [{ teamA: aWins ? 21 : 19, teamB: aWins ? 19 : 21 }] });
      }
    }

    // The three zone thirds tie on the full points chain, so the bracket waits
    // for the organizer instead of inventing a tiebreaker.
    const blockedState = await getStateSnapshot(etapa.id);
    assert.equal(blockedState.bracketsBlocked?.reason, "best_third_tie");
    const tiedIds = blockedState.bracketsBlocked?.teamIds ?? [];
    assert.equal(tiedIds.length, 3, "all three zone thirds tie on the points chain");

    const emptyRepechage = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "REPECHAJE_1" },
    });
    assert.ok(!emptyRepechage?.teamAId, "repechage stays empty until the pick");

    // The organizer names the best third; the repechage takes the other two.
    const picked = tiedIds[0]!;
    const resolved = await resolveBestThird(etapa.id, picked);
    assert.equal(resolved.ok, true, `resolve failed: ${resolved.missing.join(", ")}`);

    // Verify REPECHAJE_1 has both teams
    const re1Matches = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: "REPECHAJE_1" },
      include: { teamA: true, teamB: true },
    });
    assert.equal(re1Matches.length, 1);
    assert.ok(re1Matches[0].teamAId && re1Matches[0].teamBId, "RE1 has both teams");
    const re1Teams = [re1Matches[0].teamAId!, re1Matches[0].teamBId!];
    assert.ok(!re1Teams.includes(picked), "the picked third does not play the repechage");
    const afterState = await getStateSnapshot(etapa.id);
    assert.equal(afterState.bracketsBlocked, null, "no longer blocked");

    // Play REPECHAJE_1 (teamA always wins 21-18, so read the winner back)
    const re1 = re1Matches[0];
    await recordResult({ matchId: re1.id, setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 18 }] });
    const re1Played = await prisma.match.findFirst({
      where: { id: re1.id },
      select: { winnerId: true },
    });
    const re1Winner = re1Played?.winnerId;
    assert.ok(re1Winner, "repechage has a winner");

    // Verify QFs are filled
    const qfMatches = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: { in: ["CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"] } },
      include: { teamA: true, teamB: true },
    });
    assert.equal(qfMatches.length, 4);
    for (const qf of qfMatches) {
      assert.ok(qf.teamAId && qf.teamBId, `${qf.stage} has both teams`);
    }
    const qf2 = qfMatches.find((m) => m.stage === "CUARTOS_2")!;
    assert.ok(
      qf2.teamAId === picked || qf2.teamBId === picked,
      "the picked third (seed 7) is in CUARTOS_2",
    );
    const qf1 = qfMatches.find((m) => m.stage === "CUARTOS_1")!;
    assert.ok(
      qf1.teamAId === re1Winner || qf1.teamBId === re1Winner,
      "the repechage winner (seed 8) is in CUARTOS_1",
    );

    // Play all 4 QFs
    for (const qf of qfMatches) {
      await recordResult({ matchId: qf.id, setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 19 }] });
    }

    // Verify SEMIFINALs are filled
    const semiMatches = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2"] } },
      include: { teamA: true, teamB: true },
    });
    assert.equal(semiMatches.length, 2);
    for (const semi of semiMatches) {
      assert.ok(semi.teamAId && semi.teamBId, `${semi.stage} has both teams`);
    }

    // Fixed bracket (Andi's seeding): SEMIFINAL_1 = QF1 winner vs QF4 winner,
    // SEMIFINAL_2 = QF2 winner vs QF3 winner. Same-zone semis are allowed —
    // Andi's SEMIFINAL_2 was RG vs LM, both zone B.
    const qfWinners: Record<string, string> = {};
    for (const qf of qfMatches) {
      const played = await prisma.match.findUnique({
        where: { id: qf.id },
        select: { winnerId: true },
      });
      const w = played?.winnerId;
      assert.ok(w, `${qf.stage} has a winner`);
      qfWinners[qf.stage] = w!;
    }
    const semi1 = semiMatches.find((m) => m.stage === "SEMIFINAL_1")!;
    assert.deepEqual(
      [semi1.teamAId, semi1.teamBId].sort(),
      [qfWinners["CUARTOS_1"], qfWinners["CUARTOS_4"]].sort(),
      "SEMIFINAL_1 = QF1 winner vs QF4 winner",
    );
    const semi2 = semiMatches.find((m) => m.stage === "SEMIFINAL_2")!;
    assert.deepEqual(
      [semi2.teamAId, semi2.teamBId].sort(),
      [qfWinners["CUARTOS_2"], qfWinners["CUARTOS_3"]].sort(),
      "SEMIFINAL_2 = QF2 winner vs QF3 winner",
    );

    // Play both semis (teamA always wins 21-18, so read the winner back)
    await recordResult({ matchId: semiMatches[0].id, setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 18 }] });
    await recordResult({ matchId: semiMatches[1].id, setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 18 }] });
    const semisPlayed = await prisma.match.findMany({
      where: { id: { in: semiMatches.map((s) => s.id) } },
      select: { stage: true, teamAId: true, teamBId: true, winnerId: true },
    });
    const semiWinners = semisPlayed.map((m) => m.winnerId);
    assert.ok(semiWinners.every((w): w is string => !!w), "both semis have a winner");

    // Verify BRONZE exists with the two semifinal losers
    const bronzeMatch = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "BRONZE" },
      include: { teamA: true, teamB: true },
    });
    assert.ok(bronzeMatch, "BRONZE match exists");
    assert.ok(bronzeMatch.teamAId && bronzeMatch.teamBId, "BRONZE has both teams");
    const bronzeLosers = semisPlayed
      .flatMap((m) => [m.teamAId, m.teamBId])
      .filter((id): id is string => !!id && !semiWinners.includes(id));
    assert.equal(bronzeLosers.length, 2, "two semifinal losers");
    assert.ok(
      (bronzeMatch.teamAId === bronzeLosers[0] && bronzeMatch.teamBId === bronzeLosers[1]) ||
      (bronzeMatch.teamAId === bronzeLosers[1] && bronzeMatch.teamBId === bronzeLosers[0]),
      "BRONZE has the two semifinal losers",
    );

    // Verify FINAL has the winners
    const finalMatch = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "FINAL" },
      include: { teamA: true, teamB: true },
    });
    assert.ok(finalMatch, "FINAL match exists");
    assert.ok(finalMatch.teamAId && finalMatch.teamBId, "FINAL has both teams");
    assert.deepEqual(
      [finalMatch.teamAId, finalMatch.teamBId].sort(),
      [...semiWinners].sort(),
      "FINAL has the two semifinal winners",
    );

    // Bracket slots start without a format; the FINAL must accept the
    // best-of-three (2x21, third set as tiebreak) the tournament final uses.
    assert.equal(finalMatch!.setFormat, null, "unplayed slot has no format yet");
    await assert.rejects(
      () => recordResult({ matchId: finalMatch!.id, setFormat: "BEST_OF_3_21", sets: [{ teamA: 21, teamB: 15 }] }).then(() => {}),
      "a 2-set result cannot close a best-of-three",
    );
    await recordResult({
      matchId: finalMatch!.id,
      setFormat: "BEST_OF_3_21",
      sets: [{ teamA: 21, teamB: 15 }, { teamA: 15, teamB: 21 }, { teamA: 21, teamB: 19 }],
    });
    const finalPlayed = await prisma.match.findFirst({
      where: { id: finalMatch!.id },
      select: { setFormat: true, resultStatus: true, winnerId: true },
    });
    assert.equal(finalPlayed?.setFormat, "BEST_OF_3_21");
    assert.equal(finalPlayed?.resultStatus, "COMPLETE");
    assert.equal(finalPlayed?.winnerId, finalMatch!.teamAId, "teamA won 2-1");
  });

  it("CUARTOS: a WINNER_ONLY REPECHAJE_1 result fills CUARTOS_1's open side", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Eq${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `Male${i + 1}`,
      femaleName: `Female${i + 1}`,
    }));
    let counter = 0;
    const rng = () => { counter += 1; return (counter * 0.5) % 1; };
    const etapa = await createEtapa({ name: "Cuartos WinnerOnly", teams, bracketFormat: "CUARTOS" }, { rng });

    // Build the eliminatories state directly: RE1 with both sides, CUARTOS_1
    // with seed 1 (A1) and the B side open, phase already ELIMINATORIES.
    const zoneA = (await getTeamsByZone(etapa.id)).A.map((t) => t.id);
    assert.equal(zoneA.length, 4, "zone A has 4 teams for the seeded fixture");
    const [a1Id, reA, reB] = zoneA;
    const re1 = await prisma.match.findFirst({ where: { etapaId: etapa.id, stage: "REPECHAJE_1" } });
    const cuartos1 = await prisma.match.findFirst({ where: { etapaId: etapa.id, stage: "CUARTOS_1" } });
    assert.ok(re1 && cuartos1, "RE1 and CUARTOS_1 slots exist");
    await prisma.$transaction([
      prisma.match.update({ where: { id: re1!.id }, data: { teamAId: reA, teamBId: reB } }),
      prisma.match.update({ where: { id: cuartos1!.id }, data: { teamAId: a1Id } }),
      prisma.tournamentState.update({ where: { etapaId: etapa.id }, data: { phase: "ELIMINATORIES" } }),
    ]);

    // Quick capture from the phone: only the winner, no sets.
    await recordResult({ matchId: re1!.id, winnerId: reA });

    const filled = await prisma.match.findUnique({ where: { id: cuartos1!.id } });
    assert.equal(filled?.teamAId, a1Id, "CUARTOS_1 keeps seed 1 on side A");
    assert.equal(filled?.teamBId, reA, "WINNER_ONLY RE1 winner fills CUARTOS_1 side B");
    assert.equal(filled?.resultStatus, "PENDING", "CUARTOS_1 stays unplayed");
  });

  it("CUARTOS: the bracket hole that froze prod self-heals on refresh (RE1 winner -> CUARTOS_1) and the chain resumes", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Eq${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `Male${i + 1}`,
      femaleName: `Female${i + 1}`,
    }));
    let counter = 0;
    const rng = () => { counter += 1; return (counter * 0.5) % 1; };
    const etapa = await createEtapa({ name: "Cuartos Heal", teams, bracketFormat: "CUARTOS" }, { rng });

    // Round-robin finished: the entry queue holds only the eliminatories.
    const seedTeam = (await prisma.team.findFirst({ where: { etapaId: etapa.id, zone: "A" } }))!;
    await prisma.match.updateMany({
      where: { etapaId: etapa.id, stage: "GROUPS" },
      data: {
        resultStatus: "COMPLETE",
        winnerId: seedTeam.id,
        sets: [{ teamA: 21, teamB: 15 }],
        recordedAt: new Date(),
      },
    });

    // Seeded eliminatories: RE1 with both sides, seed 1 alone in CUARTOS_1
    // (waiting for the repechage winner), the other three QFs with both sides.
    const [a1, a2, , a4] = (await getTeamsByZone(etapa.id)).A.map((t) => t.id);
    const [b1, b2, b3, b4] = (await getTeamsByZone(etapa.id)).B.map((t) => t.id);
    const [c1, , c3] = (await getTeamsByZone(etapa.id)).C.map((t) => t.id);
    const qfRows = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: { in: ["CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"] } },
      orderBy: { slot: "asc" },
    });
    const re1 = await prisma.match.findFirst({ where: { etapaId: etapa.id, stage: "REPECHAJE_1" } });
    assert.equal(qfRows.length, 4, "four quarterfinal slots exist");
    assert.ok(re1, "the repechage slot exists");
    const [q1, q2, q3, q4] = qfRows;
    await prisma.$transaction([
      prisma.match.update({ where: { id: re1!.id }, data: { teamAId: a4, teamBId: b4 } }),
      prisma.match.update({ where: { id: q1!.id }, data: { teamAId: a1 } }),
      prisma.match.update({ where: { id: q2!.id }, data: { teamAId: a2, teamBId: b3 } }),
      prisma.match.update({ where: { id: q3!.id }, data: { teamAId: c1, teamBId: b2 } }),
      prisma.match.update({ where: { id: q4!.id }, data: { teamAId: b1, teamBId: c3 } }),
      prisma.tournamentState.update({ where: { etapaId: etapa.id }, data: { phase: "ELIMINATORIES" } }),
    ]);

    // An older build captured the repechage winner but never derived it into
    // CUARTOS_1: three QFs are played, the fourth has no opponent. This is the
    // exact hole the tournament was left in.
    await prisma.match.update({
      where: { id: re1!.id },
      data: { resultStatus: "WINNER_ONLY", winnerId: a4, recordedAt: new Date() },
    });
    for (const [qf, winner] of [[q2, a2], [q3, c1], [q4, b1]] as const) {
      await prisma.match.update({
        where: { id: qf!.id },
        data: { resultStatus: "WINNER_ONLY", winnerId: winner, recordedAt: new Date() },
      });
    }
    assert.equal(
      await getNextMatch(etapa.id),
      null,
      "stuck: nothing is playable while CUARTOS_1 has no opponent",
    );

    // Reading the state re-derives the hole, and the seeded side survives.
    const healed = await getStateSnapshot(etapa.id);
    const healedQ1 = healed.brackets.find((b) => b.stage === "CUARTOS_1");
    assert.equal(healedQ1?.teamA?.id, a1, "the seeded side of CUARTOS_1 survives");
    assert.equal(healedQ1?.teamB?.id, a4, "the RE1 winner is derived into CUARTOS_1 on refresh");
    const resumed = await getNextMatch(etapa.id);
    assert.equal(resumed?.stage, "CUARTOS_1", "the recovered quarterfinal is offered next");

    // Playing it opens the semis (QF1 x QF4, QF2 x QF3) and the chain continues.
    await recordResult({ matchId: q1!.id, winnerId: a1 });
    const semis = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2"] } },
      orderBy: { slot: "asc" },
    });
    assert.equal(semis.length, 2);
    assert.equal(semis[0].teamAId, a1);
    assert.equal(semis[0].teamBId, b1);
    assert.equal(semis[1].teamAId, a2);
    assert.equal(semis[1].teamBId, c1);
    const nextSemi = await getNextMatch(etapa.id);
    assert.ok(nextSemi && nextSemi.stage.startsWith("SEMIFINAL_"), "a semifinal is offered after all QFs");

    // Healing is repeatable and never rewrites what is already recorded.
    const before = await prisma.match.findMany({ where: { etapaId: etapa.id }, orderBy: { slot: "asc" } });
    await reconcileEliminatories(etapa.id);
    await reconcileEliminatories(etapa.id);
    const after = await prisma.match.findMany({ where: { etapaId: etapa.id }, orderBy: { slot: "asc" } });
    assert.deepEqual(after, before, "healing an already-healed bracket changes nothing");
  });

  it("CUARTOS desempate path: two tied thirds play off; winner to CUARTOS_2, loser to RE1 vs the C-zone third", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Eq${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `Male${i + 1}`,
      femaleName: `Female${i + 1}`,
    }));

    let counter = 0;
    const rng = () => { counter += 1; return (counter * 0.5) % 1; };
    const etapa = await createEtapa(
      { name: "Cuartos Desempate", teams, bracketFormat: "CUARTOS" },
      { rng },
    );

    const teamsByZone = await getTeamsByZone(etapa.id);
    const zoneA = teamsByZone.A.map((t) => t.id);
    const zoneB = teamsByZone.B.map((t) => t.id);
    const zoneC = teamsByZone.C.map((t) => t.id);
    assert.deepEqual([zoneA.length, zoneB.length, zoneC.length], [4, 3, 4]);

    const allGroupMatches = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: "GROUPS" },
      orderBy: { slot: "asc" },
    });
    const zoneOrder: readonly (readonly string[])[] = [zoneA, zoneB, zoneC];
    const rankOf = (id: string) => {
      for (const list of zoneOrder) {
        const i = list.indexOf(id);
        if (i >= 0) return i;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    const cThird = zoneC[2]!;

    for (const m of allGroupMatches) {
      const teamAId = m.teamAId!;
      const teamBId = m.teamBId!;
      const isC3VsC4 =
        (teamAId === cThird && teamBId === zoneC[3]) ||
        (teamAId === zoneC[3] && teamBId === cThird);
      const loserIsCThird =
        (teamAId === cThird || teamBId === cThird) &&
        rankOf(cThird) > rankOf(teamAId === cThird ? teamBId : teamAId);
      if (isC3VsC4) {
        const cWins = cThird === teamAId;
        await recordResult({ matchId: m.id, setFormat: "SINGLE_21", sets: [{ teamA: cWins ? 21 : 19, teamB: cWins ? 19 : 21 }] });
      } else if (loserIsCThird) {
        // C3 loses to C1/C2 by a WIDER margin, so it is NOT tied with A3/B3:
        // the restricted chain (A3 = B3 = 0 wins, −4) leaves exactly two ties.
        const aWins = teamAId !== cThird;
        await recordResult({ matchId: m.id, setFormat: "SINGLE_21", sets: [{ teamA: aWins ? 21 : 15, teamB: aWins ? 15 : 21 }] });
      } else {
        const aWins = rankOf(teamAId) <= rankOf(teamBId);
        await recordResult({ matchId: m.id, setFormat: "SINGLE_21", sets: [{ teamA: aWins ? 21 : 19, teamB: aWins ? 19 : 21 }] });
      }
    }

    const blockedState = await getStateSnapshot(etapa.id);
    assert.equal(blockedState.bracketsBlocked?.reason, "best_third_tie");
    const tiedIds = blockedState.bracketsBlocked?.teamIds ?? [];
    assert.equal(tiedIds.length, 2, "exactly two thirds tie on the points chain");

    // The organizer chooses the desempate path.
    const created = await createBestThirdDesempate(etapa.id);
    assert.equal(created.ok, true);

    const afterCreate = await getStateSnapshot(etapa.id);
    assert.equal(afterCreate.phase, "DESEMPATE");
    assert.equal(afterCreate.desempate.pending, true);

    const desempateMatch = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "DESEMPATE", resultStatus: "PENDING" },
    });
    assert.ok(desempateMatch, "a pending DESEMPATE match exists");
    assert.deepEqual(
      [desempateMatch!.teamAId, desempateMatch!.teamBId].sort(),
      [...tiedIds].sort(),
      "the desempate pairs the two tied thirds",
    );

    // A second desempate is refused while one is pending / phase moved on.
    await assert.rejects(
      () => createBestThirdDesempate(etapa.id),
      (err: unknown) => err instanceof BackError && err.status === 409,
    );

    // The draw is refused while the desempate owns the tie.
    await assert.rejects(
      () => resolveBestThird(etapa.id, tiedIds[0]!),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "desempate_already_pending",
    );

    // Play the desempate → winner advances as the best third.
    await recordResult({
      matchId: desempateMatch!.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 18 }],
    });
    const desempatePlayed = await prisma.match.findUnique({
      where: { id: desempateMatch!.id },
      select: { winnerId: true, teamAId: true, teamBId: true },
    });
    const winnerId = desempatePlayed!.winnerId!;
    const loserId =
      desempatePlayed!.teamAId === winnerId
        ? desempatePlayed!.teamBId
        : desempatePlayed!.teamAId;
    assert.ok(winnerId && loserId, "the desempate has a winner and a loser");

    const afterPlay = await getStateSnapshot(etapa.id);
    assert.equal(afterPlay.phase, "ELIMINATORIES");

    // RE1 = desempate loser vs the C-zone third; CUARTOS_1 waits for RE1,
    // while CUARTOS_2 already holds the desempate winner as the best third
    // (seed 7) and CUARTOS_4 is C1 vs C2 straight from the standings.
    const re1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "REPECHAJE_1" },
    });
    assert.ok(re1?.teamAId && re1?.teamBId, "REPECHAJE_1 has both teams");
    assert.deepEqual(
      [re1!.teamAId, re1!.teamBId].sort(),
      [loserId, cThird].sort(),
      "RE1 is the desempate loser against the C-zone third",
    );
    const cuartos1Before = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_1" },
    });
    assert.ok(
      cuartos1Before!.teamAId && !cuartos1Before!.teamBId,
      "CUARTOS_1 has A1 and waits for the REPECHAJE_1 winner",
    );
    const cuartos2Before = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_2" },
    });
    assert.ok(
      cuartos2Before!.teamAId === winnerId || cuartos2Before!.teamBId === winnerId,
      "the desempate winner (best third, seed 7) is already in CUARTOS_2",
    );
    const cuartos4Before = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_4" },
    });
    assert.ok(
      cuartos4Before!.teamAId && cuartos4Before!.teamBId,
      "CUARTOS_4 is C1 vs C2 straight from the standings",
    );

    // Play RE1 → its winner (seed 8) completes CUARTOS_1 next to A1.
    await recordResult({
      matchId: re1!.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 18 }],
    });
    const re1Played = await prisma.match.findUnique({
      where: { id: re1!.id },
      select: { winnerId: true },
    });
    const re1Winner = re1Played!.winnerId!;
    const cuartos1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_1" },
    });
    assert.ok(
      cuartos1!.teamAId === re1Winner || cuartos1!.teamBId === re1Winner,
      "the REPECHAJE_1 winner (seed 8) completes CUARTOS_1",
    );
  });

  it("interleaves the GROUPS fixture by zone at creation (no zone repeats back-to-back)", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Il${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `MaleI${i + 1}`,
      femaleName: `FemaleI${i + 1}`,
    }));
    // distributeTeams picks which zones carry the extra team with the rng, so
    // pin it: an unpinned rng makes the zone sizes (not the rotation) random.
    let counter = 0;
    const rng = () => {
      counter += 1;
      return (counter * 0.5) % 1;
    };
    const etapa = await createEtapa(
      { name: "Interleave Etapa", teams, bracketFormat: "CUARTOS" },
      { rng },
    );

    const groupRows = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: "GROUPS" },
      orderBy: { slot: "asc" },
      select: { zone: true },
    });
    const zones = groupRows.map((m) => m.zone as string);
    assert.equal(zones.length, 15, "11 teams across 3 zones play 15 group matches");
    assert.deepEqual(
      [...new Set(zones)].sort(),
      ["A", "B", "C"],
      "all three zones are represented",
    );
    for (let i = 1; i < zones.length; i++) {
      assert.notEqual(
        zones[i],
        zones[i - 1],
        `zone ${zones[i]} repeats back-to-back at slot ${i + 1}: the fixture is grouped, not rotated`,
      );
    }
  });

  it("refuses best-third and reslot mutations on a closed etapa (etapa_cerrada)", async () => {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Cl${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `MaleC${i + 1}`,
      femaleName: `FemaleC${i + 1}`,
    }));
    const etapa = await createEtapa({ name: "Closed Etapa", teams, bracketFormat: "CUARTOS" });
    await prisma.etapa.update({
      where: { id: etapa.id },
      data: { closedAt: new Date() },
    });

    await assert.rejects(
      () => resolveBestThird(etapa.id, "whatever"),
      (err: unknown) =>
        err instanceof BackError && err.status === 409 && err.reason === "etapa_cerrada",
    );
    await assert.rejects(
      () => createBestThirdDesempate(etapa.id),
      (err: unknown) =>
        err instanceof BackError && err.status === 409 && err.reason === "etapa_cerrada",
    );
    await assert.rejects(
      () => reslotGroupSchedule(etapa.id),
      (err: unknown) =>
        err instanceof BackError && err.status === 409 && err.reason === "etapa_cerrada",
    );
  });
});

/**
 * Cascade correction (editResult with cascade: true) integration tests.
 * Andi mis-loads a result mid-bracket; the organizer must be able to fix it
 * WITHOUT resetting the etapa. Cascade clears only the chain the corrected
 * match actually feeds (precise map, not the conservative DESCENDANT_STAGES
 * guard), empties the bracket slots the fill contract needs, and re-derives
 * the bracket from the corrected result.
 */
describe("cascade edit (integration)", () => {
  before(async () => {
    mkdirSync(dir, { recursive: true });
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const p = await import("./prisma");
    prisma = p.prisma;
    const back = await import("./back");
    createEtapa = back.createEtapa;
    getTeamsByZone = back.getTeamsByZone;
    recordResult = back.recordResult;
    editResult = back.editResult;
    getStateSnapshot = back.getStateSnapshot;
    BackError = back.BackError;
    const events = await import("./events");
    subscribeSse = events.subscribeSse;
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Fresh CUARTOS etapa with deterministic zones (4/3/4). */
  async function cascadeFixture() {
    const teamNames = Array.from({ length: 11 }, (_, i) => `Eq${i + 1}`);
    const teams = teamNames.map((name, i) => ({
      name,
      maleName: `Male${i + 1}`,
      femaleName: `Female${i + 1}`,
    }));
    let counter = 0;
    const rng = () => {
      counter += 1;
      return (counter * 0.5) % 1;
    };
    const etapa = await createEtapa(
      { name: "Cascade Fixture", teams, bracketFormat: "CUARTOS" },
      { rng },
    );
    const teamsByZone = await getTeamsByZone(etapa.id);
    const A = teamsByZone.A.map((t) => t.id);
    const B = teamsByZone.B.map((t) => t.id);
    const C = teamsByZone.C.map((t) => t.id);
    assert.deepEqual([A.length, B.length, C.length], [4, 3, 4]);
    return { etapa, A, B, C };
  }

  /**
   * Directly seeds the FULL bracket as already played, so a cascade edit is
   * truly blocked without the flag. RE1 = A3 vs B3 (A3 wins). Below follow
   * the fixed bracket pairing: CUARTOS_1 = A1 vs A3 (1v8), CUARTOS_2 = C1 vs
   * C3, CUARTOS_3 = A2 vs B1, CUARTOS_4 = B2 vs C2, SEMIFINAL_1 = Q1w vs
   * Q4w, SEMIFINAL_2 = Q2w vs Q3w, BRONZE = both semi losers, FINAL = both
   * semi winners.
   */
  async function seedLockedBracket(
    etapaId: string,
    A: readonly string[],
    B: readonly string[],
    C: readonly string[],
  ) {
    const [a1, , a3] = A;
    const [b1, b2] = B;
    const [c1, c3] = C;
    const slots = [
      { stage: "REPECHAJE_1", teamAId: a3, teamBId: B[2]!, winnerId: a3 },
      { stage: "CUARTOS_1", teamAId: a1, teamBId: a3, winnerId: a1 },
      { stage: "CUARTOS_2", teamAId: c1, teamBId: c3, winnerId: c1 },
      { stage: "CUARTOS_3", teamAId: A[1]!, teamBId: b1, winnerId: b1 },
      { stage: "CUARTOS_4", teamAId: b2, teamBId: C[1]!, winnerId: b2 },
      { stage: "SEMIFINAL_1", teamAId: a1, teamBId: b2, winnerId: a1 },
      { stage: "SEMIFINAL_2", teamAId: c1, teamBId: b1, winnerId: c1 },
      { stage: "BRONZE", teamAId: b2, teamBId: b1, winnerId: b2 },
      { stage: "FINAL", teamAId: a1, teamBId: c1, winnerId: a1 },
    ];
    for (const s of slots) {
      await prisma.match.updateMany({
        where: { etapaId, stage: s.stage as Stage },
        data: {
          teamAId: s.teamAId,
          teamBId: s.teamBId,
          resultStatus: "COMPLETE",
          winnerId: s.winnerId,
          setFormat: "SINGLE_21",
          sets: [{ teamA: 21, teamB: 15 }],
          recordedAt: new Date(),
        },
      });
    }
    await prisma.tournamentState.update({
      where: { etapaId },
      data: { phase: "ELIMINATORIES" },
    });
  }

  it("still blocks a locked correction without cascade (editing_blocks_bracket)", async () => {
    const { etapa, A, B, C } = await cascadeFixture();
    await seedLockedBracket(etapa.id, A, B, C);
    const cuartos2 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_2" },
    });

    await assert.rejects(
      () =>
        editResult({
          matchId: cuartos2!.id,
          setFormat: "SINGLE_21",
          sets: [{ teamA: 21, teamB: 15 }],
        }),
      (err: unknown) =>
        err instanceof BackError &&
        err.status === 409 &&
        err.reason === "editing_blocks_bracket",
    );
  });

  it("REPECHAJE_1 cascade clears CUARTOS_1 + one semi + BRONZE/FINAL and re-derives the bracket", async () => {
    const { etapa, A, B, C } = await cascadeFixture();
    await seedLockedBracket(etapa.id, A, B, C);
    const re1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "REPECHAJE_1" },
    });

    // Andi flips who won the repechage: A3 (teamA) becomes B3 (teamB).
    await editResult({
      matchId: re1!.id,
      cascade: true,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 15, teamB: 21 }],
    });

    const re1After = await prisma.match.findUnique({
      where: { id: re1!.id },
      select: { resultStatus: true, winnerId: true },
    });
    assert.equal(re1After?.resultStatus, "COMPLETE");
    assert.equal(re1After?.winnerId, B[2], "the corrected RE1 winner is B3");

    // CUARTOS_1 was invalidated and re-derived immediately: seed A1 survives,
    // the open side takes the NEW repechage winner.
    const q1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_1" },
    });
    assert.equal(q1?.resultStatus, "PENDING");
    assert.equal(q1?.teamAId, A[0], "seeded A1 side survives the cascade");
    assert.equal(q1?.teamBId, B[2], "new RE1 winner fills CUARTOS_1");

    // The invalidated chain is cleared; the INDEPENDENT semi keeps its result
    // (its slot is emptied only so the fill can re-seed both semis).
    const sf1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "SEMIFINAL_1" },
    });
    assert.equal(sf1?.resultStatus, "PENDING");
    assert.equal(sf1?.teamAId, null, "invalidated semi loses its teams");
    const sf2 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "SEMIFINAL_2" },
    });
    assert.equal(sf2?.resultStatus, "COMPLETE", "independent semi keeps its result");
    assert.equal(sf2?.teamAId, null, "slot emptied for the fill to re-seed");
    const bronze = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "BRONZE" },
    });
    assert.equal(bronze?.resultStatus, "PENDING");
    assert.equal(bronze?.teamAId, null);
    const final = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "FINAL" },
    });
    assert.equal(final?.resultStatus, "PENDING");
    assert.equal(final?.teamAId, null);
    const q2 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_2" },
    });
    assert.equal(q2?.resultStatus, "COMPLETE", "independent quarterfinal untouched");

    // Reload CUARTOS_1 → the CUARTOS fill re-seeds BOTH semis from the four
    // quarterfinal winners.
    await recordResult({
      matchId: q1!.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 18 }],
    });
    const sf1Refilled = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "SEMIFINAL_1" },
    });
    assert.deepEqual(
      [sf1Refilled!.teamAId, sf1Refilled!.teamBId].sort(),
      [A[0], B[1]].sort(),
      "SEMIFINAL_1 = new Q1 winner vs Q4 winner",
    );
    const sf2Refilled = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "SEMIFINAL_2" },
    });
    assert.deepEqual(
      [sf2Refilled!.teamAId, sf2Refilled!.teamBId].sort(),
      [C[0], B[0]].sort(),
      "SEMIFINAL_2 re-seeded from Q2/Q3 winners",
    );

    // Reload SEMIFINAL_1 → BRONZE and FINAL refill from the semi winners.
    await recordResult({
      matchId: sf1Refilled!.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 18 }],
    });
    const finalRefilled = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "FINAL" },
    });
    assert.deepEqual(
      [finalRefilled!.teamAId, finalRefilled!.teamBId].sort(),
      [A[0], C[0]].sort(),
      "FINAL = both semi winners",
    );
    const bronzeRefilled = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "BRONZE" },
    });
    assert.deepEqual(
      [bronzeRefilled!.teamAId, bronzeRefilled!.teamBId].sort(),
      [B[1], B[0]].sort(),
      "BRONZE = both semi losers",
    );
  });

  it("CUARTOS_1 cascade clears only its semi + BRONZE + FINAL; the other semi keeps its result", async () => {
    const { etapa, A, B, C } = await cascadeFixture();
    await seedLockedBracket(etapa.id, A, B, C);
    const q1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_1" },
    });

    // Andi flips the quarterfinal: the RE1 winner (A3, teamB) beats A1.
    await editResult({
      matchId: q1!.id,
      cascade: true,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 15, teamB: 21 }],
    });

    const q1After = await prisma.match.findUnique({
      where: { id: q1!.id },
      select: { resultStatus: true, winnerId: true },
    });
    assert.equal(q1After?.resultStatus, "COMPLETE");
    assert.equal(q1After?.winnerId, A[2], "the corrected QF1 winner is the RE1 winner");

    // The CUARTOS fill re-seeded both semis right away (all 4 QFs decided);
    // the affected semi lost its result, the other one kept it.
    const sf1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "SEMIFINAL_1" },
    });
    assert.deepEqual(
      [sf1!.teamAId, sf1!.teamBId].sort(),
      [A[2], B[1]].sort(),
      "SEMIFINAL_1 = corrected Q1 winner vs Q4 winner",
    );
    assert.equal(sf1?.resultStatus, "PENDING");
    const sf2 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "SEMIFINAL_2" },
    });
    assert.equal(sf2?.resultStatus, "COMPLETE", "SEMIFINAL_2 keeps its result");
    assert.deepEqual(
      [sf2!.teamAId, sf2!.teamBId].sort(),
      [C[0], B[0]].sort(),
    );

    // BRONZE + FINAL wait for the affected semi to be re-loaded.
    const bronze = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "BRONZE" },
    });
    assert.equal(bronze?.resultStatus, "PENDING");
    assert.equal(bronze?.teamAId, null);
    const final = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "FINAL" },
    });
    assert.equal(final?.resultStatus, "PENDING");
    assert.equal(final?.teamAId, null);

    await recordResult({
      matchId: sf1!.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 18 }],
    });
    const finalRefilled = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "FINAL" },
    });
    assert.deepEqual(
      [finalRefilled!.teamAId, finalRefilled!.teamBId].sort(),
      [A[2], C[0]].sort(),
      "FINAL = both semi winners",
    );
  });

  it("GROUPS cascade wipes the whole bracket and the corrected group result rebuilds it", async () => {
    const { etapa, A, B, C } = await cascadeFixture();

    // Decide every group match by rank. The three zone thirds lose to their
    // top 2 by DIFFERENT margins (19/17/15), so the best third is distinct
    // and the bracket builds without an organizer tiebreak.
    const allGroupMatches = await prisma.match.findMany({
      where: { etapaId: etapa.id, stage: "GROUPS" },
      orderBy: { slot: "asc" },
    });
    const zoneOrder: readonly (readonly string[])[] = [A, B, C];
    const rankOf = (id: string) => {
      for (const list of zoneOrder) {
        const i = list.indexOf(id);
        if (i >= 0) return i;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    const b3 = B[2]!;
    const c3 = C[2]!;
    const thirdLossAgainstTop2 = (
      m: { teamAId: string | null; teamBId: string | null },
      thirdId: string,
      zone: readonly string[],
    ) => {
      const opp = m.teamAId === thirdId ? m.teamBId : m.teamAId;
      return opp !== null && zone.includes(opp) && zone.indexOf(opp) <= 1;
    };
    for (const m of allGroupMatches) {
      const teamAId = m.teamAId!;
      const teamBId = m.teamBId!;
      const aWins = rankOf(teamAId) <= rankOf(teamBId);
      let loserScore = 19;
      if (thirdLossAgainstTop2(m, b3, B)) loserScore = 17;
      else if (thirdLossAgainstTop2(m, c3, C)) loserScore = 15;
      await recordResult({
        matchId: m.id,
        setFormat: "SINGLE_21",
        sets: [
          { teamA: aWins ? 21 : loserScore, teamB: aWins ? loserScore : 21 },
        ],
      });
    }

    const before = await getStateSnapshot(etapa.id);
    assert.equal(before.bracketsBlocked, null, "no tie: the bracket built itself");
    assert.equal(before.phase, "ELIMINATORIES");

    // Andi flips the zone-A top match: A1 vs A2, so the corrected standings
    // swap the zone champion. The thirds chain keeps A3 as the best third.
    const a1vsA2 = allGroupMatches.find(
      (m) =>
        (m.teamAId === A[0] && m.teamBId === A[1]) ||
        (m.teamAId === A[1] && m.teamBId === A[0]),
    );
    assert.ok(a1vsA2, "the A1 vs A2 match exists");
    const beforeFlip = await prisma.match.findUnique({
      where: { id: a1vsA2!.id },
      select: { winnerId: true },
    });
    const newWinner = beforeFlip?.winnerId === A[0] ? A[1] : A[0];
    await editResult({
      matchId: a1vsA2!.id,
      cascade: true,
      winnerId: newWinner,
    });

    // The whole eliminatories chain is PENDING again; the group results stay
    // (the edited one carries the corrected winner).
    const allElim = await prisma.match.findMany({
      where: {
        etapaId: etapa.id,
        stage: {
          in: [
            "REPECHAJE_1",
            "REPECHAJE_2",
            "CUARTOS_1",
            "CUARTOS_2",
            "CUARTOS_3",
            "CUARTOS_4",
            "SEMIFINAL_1",
            "SEMIFINAL_2",
            "BRONZE",
            "FINAL",
          ] as Stage[],
        },
      },
    });
    assert.ok(
      allElim.every((m) => m.resultStatus === "PENDING"),
      "every eliminatories stage is PENDING after the group cascade",
    );

    // The bracket rebuilt itself from the corrected standings: RE1 + QFs are
    // seeded; semis/BRONZE/FINAL wait for results.
    const re1 = allElim.find((m) => m.stage === "REPECHAJE_1")!;
    assert.ok(re1.teamAId && re1.teamBId, "REPECHAJE_1 re-seeded by the rebracket");
    const qfs = allElim.filter((m) => m.stage.startsWith("CUARTOS_"));
    assert.equal(qfs.length, 4);
    // Every QF has its standing-seeded side; CUARTOS_1's open side waits for
    // the RE1 winner (filled on reload), the others pair straight from the
    // standings.
    assert.ok(qfs.every((m) => m.teamAId), "all QFs re-seeded by the rebracket");
    assert.ok(
      qfs
        .filter((m) => m.stage !== "CUARTOS_1")
        .every((m) => m.teamAId && m.teamBId),
      "QF2..4 pair straight from the standings",
    );
    assert.equal(
      qfs.find((m) => m.stage === "CUARTOS_1")?.teamBId,
      null,
      "CUARTOS_1 side B waits for REPECHAJE_1",
    );
    const semisEmpty = allElim.filter(
      (m) => m.stage === "SEMIFINAL_1" || m.stage === "SEMIFINAL_2",
    );
    assert.ok(
      semisEmpty.every((m) => !m.teamAId && !m.teamBId),
      "semis stay empty until the QFs are re-played",
    );

    // Andi reloads the eliminatories normally: RE1 → CUARTOS_1, QFs → semis,
    // semis → BRONZE + FINAL.
    await recordResult({
      matchId: re1.id,
      setFormat: "SINGLE_21",
      sets: [{ teamA: 21, teamB: 18 }],
    });
    const q1 = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "CUARTOS_1" },
    });
    assert.ok(q1?.teamAId && q1?.teamBId, "CUARTOS_1 filled after RE1 reload");
    for (const qf of qfs) {
      await recordResult({
        matchId: qf.id,
        setFormat: "SINGLE_21",
        sets: [{ teamA: 21, teamB: 18 }],
      });
    }
    const semis = await prisma.match.findMany({
      where: {
        etapaId: etapa.id,
        stage: { in: ["SEMIFINAL_1", "SEMIFINAL_2"] as Stage[] },
      },
    });
    assert.ok(semis.every((m) => m.teamAId && m.teamBId), "semis refilled from QF winners");
    for (const s of semis) {
      await recordResult({
        matchId: s.id,
        setFormat: "SINGLE_21",
        sets: [{ teamA: 21, teamB: 18 }],
      });
    }
    const finalMatch = await prisma.match.findFirst({
      where: { etapaId: etapa.id, stage: "FINAL" },
    });
    assert.ok(
      finalMatch?.teamAId && finalMatch?.teamBId,
      "FINAL refilled after the semis reload",
    );
  });
});

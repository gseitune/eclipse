import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSchedule, isEditableMatch, type ScheduleMatchInput } from "./schedule";
import { computeTimeEstimate } from "./time-estimate";

function match(
  slot: number,
  timeLabel: string | null,
  status: "PENDING" | "WINNER_ONLY" | "COMPLETE" = "PENDING",
  recordedAt: Date | null = null,
  stage = "GROUPS",
  sets: { teamA: number; teamB: number }[] | null = null,
  setFormat: "SINGLE_21" | "TWO_15_TIEBREAK" | "BEST_OF_3_21" | null = null,
  manualStartAt: string | null = null,
  manualEndAt: string | null = null,
): ScheduleMatchInput {
  return {
    id: `m${slot}`,
    slot,
    stage,
    timeLabel,
    sets,
    setFormat,
    resultStatus: status,
    recordedAt,
    manualStartAt,
    manualEndAt,
  };
}

describe("computeSchedule", () => {
  const base = [
    match(1, "10:00 - 10:20"),
    match(2, "10:20 - 10:40"),
    match(3, "10:40 - 11:00"),
  ];

  it("keeps the scheduled windows while nothing was recorded", () => {
    const rows = computeSchedule(base, 5, 20);
    assert.deepEqual(
      rows.map((r) => [r.scheduled, r.estimated]),
      [
        ["10:00 - 10:20", null],
        ["10:20 - 10:40", null],
        ["10:40 - 11:00", null],
      ],
    );
  });

  it("chains estimates for pending matches after the first recorded result", () => {
    const matches = [
      match(1, "10:00 - 10:20", "COMPLETE", new Date(2026, 8, 23, 10, 0, 0)),
      match(2, "10:20 - 10:40"),
      match(3, "10:40 - 11:00"),
    ];
    const rows = computeSchedule(matches, 5, 20);
    assert.equal(rows[0].estimated, null, "decided match has no estimate");
    assert.equal(rows[1].estimated, "10:05 - 10:25", "result + 5 min prep");
    assert.equal(rows[2].estimated, "10:25 - 10:45", "chains by match duration");
  });

  it("keeps pending matches BEFORE the first recorded result untouched", () => {
    const matches = [
      match(1, "10:00 - 10:20"),
      match(2, "10:20 - 10:40", "WINNER_ONLY", new Date(2026, 8, 23, 10, 30, 0)),
      match(3, "10:40 - 11:00"),
    ];
    const rows = computeSchedule(matches, 5, 20);
    assert.equal(rows[0].estimated, null, "slot before anchor stays as scheduled");
    assert.equal(rows[1].estimated, null, "decided matches have no estimate");
    assert.equal(rows[2].estimated, "10:35 - 10:55", "10:30 result + 5 min");
  });

  it("respects a configurable preparation time", () => {
    const matches = [
      match(1, "10:00 - 10:20", "COMPLETE", new Date(2026, 8, 23, 10, 0, 0)),
      match(2, "10:20 - 10:40"),
    ];
    const rows = computeSchedule(matches, 0, 20);
    assert.equal(rows[1].estimated, "10:00 - 10:20", "prep 0 kept the window");
  });

  it("includes a DESEMPATE match in the estimate chain before the semis", () => {
    const matches = [
      match(1, "10:00 - 10:20", "COMPLETE", new Date(2026, 8, 23, 10, 0, 0)),
      match(2, null, "PENDING", null, "DESEMPATE"),
      match(3, "16:40 - 17:00", "PENDING", null, "SEMIFINAL_1"),
    ];
    const rows = computeSchedule(matches, 5, 20);
    assert.equal(rows[1].scheduled, null, "desempate has no base fixture time");
    assert.equal(rows[1].estimated, "10:05 - 10:25", "desempate chains from the result");
    assert.equal(rows[1].stage, "DESEMPATE");
    assert.equal(rows[2].estimated, "10:25 - 10:45", "semis chain after the desempate");
  });

  it("exposes the multi-set score and format on rows (passthrough)", () => {
    const matches = [
      match(
        1,
        "10:00 - 10:20",
        "COMPLETE",
        new Date(2026, 8, 23, 10, 0, 0),
        "GROUPS",
        [{ teamA: 21, teamB: 19 }],
        "SINGLE_21",
      ),
      match(2, "10:20 - 10:40"),
    ];
    const rows = computeSchedule(matches, 5, 20);
    assert.deepEqual(rows[0].sets, [{ teamA: 21, teamB: 19 }]);
    assert.equal(rows[0].setFormat, "SINGLE_21");
    assert.equal(rows[1].sets, null);
    assert.equal(rows[1].setFormat, null);
  });
});

function matchWithManual(
  slot: number,
  timeLabel: string | null,
  manualStartAt: string | null = null,
  manualEndAt: string | null = null,
  status: "PENDING" | "WINNER_ONLY" | "COMPLETE" = "PENDING",
  recordedAt: Date | null = null,
  stage = "GROUPS",
): ScheduleMatchInput {
  return {
    id: `m${slot}`,
    slot,
    stage,
    timeLabel,
    sets: null,
    setFormat: null,
    resultStatus: status,
    recordedAt,
    manualStartAt,
    manualEndAt,
  };
}

describe("isEditableMatch (edit guard)", () => {
  const played = (slot: number, stage = "GROUPS"): ScheduleMatchInput =>
    match(slot, "10:00 - 10:20", "COMPLETE", new Date(2026, 8, 23, 10, 0, 0), stage);
  const pending = (slot: number, stage = "GROUPS"): ScheduleMatchInput =>
    match(slot, "10:00 - 10:20", "PENDING", null, stage);

  it("is false for a match without a result", () => {
    const all = [pending(1), pending(2)];
    assert.equal(isEditableMatch(all[0], all), false);
  });

  it("is true for a GROUPS match while nothing downstream played", () => {
    const all = [played(1), pending(2, "SEMIFINAL_1")];
    assert.equal(isEditableMatch(all[0], all), true);
  });

  it("is false for a GROUPS match once a semifinal played", () => {
    const all = [played(1), played(2, "SEMIFINAL_1")];
    assert.equal(isEditableMatch(all[0], all), false, "group edit would invalidate the bracket");
  });

  it("is false for a GROUPS match once the DESEMPATE played", () => {
    const all = [played(1), played(2, "DESEMPATE")];
    assert.equal(isEditableMatch(all[0], all), false);
  });

  it("is true for a GROUPS match while the DESEMPATE is only pending", () => {
    const all = [played(1), pending(2, "DESEMPATE"), pending(3, "SEMIFINAL_1")];
    assert.equal(isEditableMatch(all[0], all), true);
  });

  it("is false for a semifinal once the final played", () => {
    const all = [played(1, "SEMIFINAL_1"), played(2, "FINAL")];
    assert.equal(isEditableMatch(all[0], all), false);
  });

  it("is true for a semifinal while the final is pending", () => {
    const all = [played(1, "SEMIFINAL_1"), pending(2, "FINAL")];
    assert.equal(isEditableMatch(all[0], all), true);
  });

  it("is true for a played FINAL (no descendants)", () => {
    const all = [played(1, "FINAL")];
    assert.equal(isEditableMatch(all[0], all), true);
  });

it("exposes the flag on schedule rows", () => {
     const all = [played(1), played(2, "SEMIFINAL_1")];
     const rows = computeSchedule(all, 5, 20);
     assert.equal(rows[0].editable, false, "group closed by played semi");
     assert.equal(rows[1].editable, true, "semi before the final stays editable");
   });

  it("manual window wins over automatic estimate when manualStartAt is set", () => {
    const matches = [
      match(1, "10:00 - 10:20", "COMPLETE", new Date(2026, 8, 23, 10, 0, 0)),
      matchWithManual(2, "10:20 - 10:40", "2026-09-26T14:00:00.000Z", "2026-09-26T14:20:00.000Z", "PENDING"),
      match(3, "10:40 - 11:00"),
    ];
    const rows = computeSchedule(matches, 5, 20);
    // Match 2 with manual times should have non-null scheduled from manual window
    assert.ok(rows[1].scheduled, "scheduled should be non-null from manual window");
    assert.ok(rows[1].scheduled!.includes("14:00") || rows[1].scheduled!.includes("11:00"),
      "scheduled reflects manual time");
    // Manual fields should be present on the row
    assert.ok(rows[1].manualStartAt, "manualStartAt present on match with manual times");
    assert.ok(rows[1].manualEndAt, "manualEndAt present on match with manual times");
    // Match 3 should have null manual fields
    assert.equal(rows[2].manualStartAt, null);
    assert.equal(rows[2].manualEndAt, null);
  });

  it("no manual times → unchanged behavior", () => {
    const matches = [
      match(1, "10:00 - 10:20", "COMPLETE", new Date(2026, 8, 23, 10, 0, 0)),
      match(2, "10:20 - 10:40"),
    ];
    const rows = computeSchedule(matches, 5, 20);
    assert.equal(rows[1].scheduled, "10:20 - 10:40", "no manual → timeLabel preserved");
    assert.equal(rows[1].manualStartAt, null);
    assert.equal(rows[1].manualEndAt, null);
  });
});

describe("computeTimeEstimate", () => {
  const nowMs = new Date("2026-09-26T18:00:00.000Z").getTime();
  const tournamentStartMs = new Date("2026-09-26T13:00:00.000Z").getTime();
  const defaultMs = 1_200_000; // 20 minutes

  it("returns null when no row has manualStartAt", () => {
    const result = computeTimeEstimate(
      [
        { resultStatus: "PENDING" },
        { resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.strictEqual(result, null, "should return null when no manualStartAt");
  });

  it("returns null when no row has manualStartAt", () => {
    const result = computeTimeEstimate(
      [
        { resultStatus: "PENDING" },
        { resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.strictEqual(result, null, "should return null when no manualStartAt");
  });

  it("2 pending matches with manualStartAt → remaining reflects elapsed time", () => {
    const tenMinAgoMs = nowMs - 10 * 60 * 1000;
    const startIso = new Date(tenMinAgoMs).toISOString();
    const result = computeTimeEstimate(
      [
        { manualStartAt: startIso, resultStatus: "PENDING" },
        { manualStartAt: startIso, resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    assert.equal(result!.elapsedMs, 10 * 60 * 1000);
  });

  it("an in-progress match started 10 min ago drops remaining to 10 min", () => {
    const tenMinAgoMs = nowMs - 10 * 60 * 1000;
    const result = computeTimeEstimate(
      [
        { manualStartAt: new Date(tenMinAgoMs).toISOString(), resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    assert.equal(result!.remainingMs, defaultMs - 10 * 60 * 1000, "remaining should be 10 min");
    assert.equal(result!.estimatedEndAt, nowMs + (defaultMs - 10 * 60 * 1000));
  });

  it("a delayed match shifts estimatedEndAt forward", () => {
    const laterNowMs = nowMs + 30 * 60 * 1000;
    const result = computeTimeEstimate(
      [
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "PENDING" },
      ],
      laterNowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    const expectedRemaining = Math.max(0, defaultMs - (laterNowMs - tournamentStartMs));
    assert.equal(result!.remainingMs, expectedRemaining);
    assert.equal(result!.estimatedEndAt, laterNowMs + expectedRemaining);
  });

  it("pendingCount counts rows without results, inProgressCount counts rows with manualStartAt but not COMPLETE", () => {
    const result = computeTimeEstimate(
      [
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "PENDING" },
        { manualStartAt: "2026-09-26T13:30:00.000Z", resultStatus: "COMPLETE" },
        { manualStartAt: "2026-09-26T14:00:00.000Z", resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    assert.equal(result!.pendingCount, 2, "2 PENDING rows");
    assert.equal(result!.inProgressCount, 2, "2 rows with manualStartAt but not COMPLETE");
  });

  it("COMPLETE rows contribute 0 to remainingMs", () => {
    const result = computeTimeEstimate(
      [
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "COMPLETE" },
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    assert.equal(result!.pendingCount, 1);
    assert.equal(result!.inProgressCount, 1);
  });

  it("rows with manualEndAt use endMs - nowMs for remaining contribution", () => {
    const endMs = nowMs + 5 * 60 * 1000; // 5 min from now
    const result = computeTimeEstimate(
      [
        { manualStartAt: "2026-09-26T13:00:00.000Z", manualEndAt: new Date(endMs).toISOString(), resultStatus: "PENDING" },
      ],
      nowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    assert.equal(result!.remainingMs, 5 * 60 * 1000, "remaining should be 5 min");
  });
});
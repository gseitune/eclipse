import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSchedule, type ScheduleMatchInput } from "./schedule";

function match(
  slot: number,
  timeLabel: string,
  status: "PENDING" | "WINNER_ONLY" | "COMPLETE" = "PENDING",
  recordedAt: Date | null = null,
): ScheduleMatchInput {
  return {
    id: `m${slot}`,
    slot,
    stage: "GROUPS",
    timeLabel,
    resultStatus: status,
    recordedAt,
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
});
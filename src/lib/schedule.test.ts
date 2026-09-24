import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSchedule, isEditableMatch, type ScheduleMatchInput } from "./schedule";

function match(
  slot: number,
  timeLabel: string | null,
  status: "PENDING" | "WINNER_ONLY" | "COMPLETE" = "PENDING",
  recordedAt: Date | null = null,
  stage = "GROUPS",
): ScheduleMatchInput {
  return {
    id: `m${slot}`,
    slot,
    stage,
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
});

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
});
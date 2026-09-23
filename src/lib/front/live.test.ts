import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { liveMatchIds } from "./live";
import type { ScheduleRow } from "./types";

function makeSchedule(rows: Array<{ id: string; scheduled?: string | null; estimated?: string | null }>): ScheduleRow[] {
  return rows.map((r) => ({
    id: r.id,
    slot: 0,
    stage: "GROUPS",
    scheduled: r.scheduled ?? null,
    estimated: r.estimated ?? null,
    estimatedFromResult: false,
  }));
}

describe("liveMatchIds", () => {
  it("returns matches whose window contains the current time", () => {
    const schedule = makeSchedule([
      { id: "m1", scheduled: "10:00 - 10:20" },
      { id: "m2", scheduled: "10:30 - 10:50" },
    ]);
    const now = new Date("2026-01-01T10:10:00").getTime();
    const result = liveMatchIds(schedule, 20, now);
    assert.equal(result.has("m1"), true);
    assert.equal(result.has("m2"), false);
  });

  it("end-of-window boundary: match ending exactly at now is NOT live", () => {
    const schedule = makeSchedule([{ id: "m1", scheduled: "10:00 - 10:20" }]);
    const now = new Date("2026-01-01T10:20:00").getTime();
    const result = liveMatchIds(schedule, 20, now);
    assert.equal(result.has("m1"), false);
  });

  it("start-of-window boundary: match starting exactly at now is NOT live (strict <)", () => {
    const schedule = makeSchedule([{ id: "m1", scheduled: "10:00 - 10:20" }]);
    const now = new Date("2026-01-01T10:00:00").getTime();
    const result = liveMatchIds(schedule, 20, now);
    assert.equal(result.has("m1"), false);
  });

  it("estimated is preferred over scheduled", () => {
    const schedule = makeSchedule([
      { id: "m1", scheduled: "09:00 - 09:20", estimated: "10:00 - 10:20" },
    ]);
    const now = new Date("2026-01-01T10:10:00").getTime();
    const result = liveMatchIds(schedule, 20, now);
    assert.equal(result.has("m1"), true);
  });

  it("single-start field uses matchMinutes to compute end", () => {
    const schedule = makeSchedule([{ id: "m1", estimated: "10:00" }]);
    const now = new Date("2026-01-01T10:10:00").getTime();
    const result = liveMatchIds(schedule, 20, now);
    assert.equal(result.has("m1"), true);
  });

  it("single-start field: match ends before now when matchMinutes is exceeded", () => {
    const schedule = makeSchedule([{ id: "m1", estimated: "10:00" }]);
    const now = new Date("2026-01-01T10:30:00").getTime();
    const result = liveMatchIds(schedule, 20, now);
    assert.equal(result.has("m1"), false);
  });

  it("empty input returns empty set", () => {
    const result = liveMatchIds([], 20, Date.now());
    assert.equal(result.size, 0);
  });

  it("returns empty set when no time fields present", () => {
    const schedule = makeSchedule([{ id: "m1", scheduled: null, estimated: null }]);
    const result = liveMatchIds(schedule, 20, Date.now());
    assert.equal(result.size, 0);
  });
});

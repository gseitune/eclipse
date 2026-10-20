import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { liveMatchIds, liveMatchIdsForEtapa } from "./live";
import type { EtapaMeta, ScheduleRow } from "./types";

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

/** Etapa metadata. Defaults describe an open etapa; override to change state. */
function makeEtapa(overrides: Partial<EtapaMeta> = {}): EtapaMeta {
  return {
    id: "e1",
    name: "Etapa 6",
    date: "2026-09-27T00:00:00.000Z",
    circuit: "PRINCIPIANTES",
    season: 2026,
    setFormat: null,
    sortOrder: 2,
    teamCount: 11,
    closedAt: null,
    cancelledAt: null,
    played: true,
    ...overrides,
  };
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

describe("liveMatchIdsForEtapa", () => {
  // Same schedule and same instant for every case below: the only thing that
  // changes is the etapa state, so a difference in result can only come from it.
  const schedule = makeSchedule([{ id: "m1", estimated: "10:00 - 10:20" }]);
  const insideWindow = new Date("2026-01-01T10:10:00").getTime();

  it("control: an open etapa reports the match as live while its window is open", () => {
    const result = liveMatchIdsForEtapa(schedule, 20, makeEtapa(), insideWindow);
    assert.equal(result.has("m1"), true);
  });

  it("a closed etapa reports no live matches, even while its window is open", () => {
    const closed = makeEtapa({ closedAt: "2026-10-13T14:22:10.667Z" });
    const result = liveMatchIdsForEtapa(schedule, 20, closed, insideWindow);
    assert.equal(result.size, 0);
  });

  it("a cancelled etapa reports no live matches, even while its window is open", () => {
    const cancelled = makeEtapa({ cancelledAt: "2026-10-13T14:22:10.667Z" });
    const result = liveMatchIdsForEtapa(schedule, 20, cancelled, insideWindow);
    assert.equal(result.size, 0);
  });

  it("without etapa metadata the schedule is evaluated as before", () => {
    const result = liveMatchIdsForEtapa(schedule, 20, null, insideWindow);
    assert.equal(result.has("m1"), true);
  });
});

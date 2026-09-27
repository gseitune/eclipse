import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeTimeEstimate } from "./time-estimate";

/**
 * Tests for computeTimeEstimate — pure helper with injectable clock.
 *
 * Scenario: tournament start 13:00, now 18:00, 2 pending matches,
 * defaultMs such that remaining = 40 min (i.e. each pending = 20 min
 * = 1,200,000 ms → elapsed 4 h, remaining 40 min, end 18:40).
 * An in-progress match started 10 min ago → remaining drops to 10 min.
 * A delayed match → estimatedEndAt shifts forward.
 * No rows with manualStartAt → null.
 */

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

  it("tournament start near now, 2 pending matches → remaining = 2 × defaultMs", () => {
    // Set start time 10 minutes ago so elapsed < defaultMs
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
    assert.equal(result!.elapsedMs, 10 * 60 * 1000, "elapsed should be 10 minutes");
    assert.equal(result!.remainingMs, 2 * Math.max(0, defaultMs - 10 * 60 * 1000), "remaining should be 2 × (20min - 10min) = 20min");
    assert.equal(result!.estimatedEndAt, nowMs + result!.remainingMs, "estimatedEndAt should be now + remaining");
  });

  it("tournament start 13:00, now 18:00, 2 pending matches with large defaultMs → remaining reflects elapsed time", () => {
    const largeDefaultMs = 6 * 60 * 60 * 1000; // 6 hours
    const result = computeTimeEstimate(
      [
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "PENDING" },
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "PENDING" },
      ],
      nowMs,
      largeDefaultMs,
    );
    assert.ok(result, "should not be null");
    assert.equal(result!.tournamentStart, tournamentStartMs);
    assert.equal(result!.elapsedMs, 5 * 60 * 60 * 1000, "elapsed should be 5 hours");
    // Each match: max(0, 6h - 5h) = 1h, so total = 2h
    assert.equal(result!.remainingMs, 2 * (largeDefaultMs - 5 * 60 * 60 * 1000), "remaining reflects elapsed time");
    assert.equal(result!.estimatedEndAt, nowMs + 2 * (largeDefaultMs - 5 * 60 * 60 * 1000));
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
    // remaining = defaultMs - (nowMs - startMs) = 1200000 - 600000 = 600000 (10 min)
    assert.equal(result!.remainingMs, defaultMs - 10 * 60 * 1000, "remaining should be 10 min");
    assert.equal(result!.estimatedEndAt, nowMs + (defaultMs - 10 * 60 * 1000));
  });

  it("a delayed match shifts estimatedEndAt forward", () => {
    const laterNowMs = nowMs + 30 * 60 * 1000; // 30 min later
    const result = computeTimeEstimate(
      [
        { manualStartAt: "2026-09-26T13:00:00.000Z", resultStatus: "PENDING" },
      ],
      laterNowMs,
      defaultMs,
    );
    assert.ok(result, "should not be null");
    // elapsed is now 5h instead of 4h, but remaining is still defaultMs
    // because startMs is the same and we compute remaining = defaultMs - (laterNowMs - startMs)
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

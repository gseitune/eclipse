import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POSITION_POINTS,
  positionPoints,
  computeFinalPositions,
} from "./ranking";

import type { StandingRow } from "./standings";
import type { Zone } from "../generated/prisma/client";

const A: Zone = "A";
const B: Zone = "B";
const C: Zone = "C";

function row(teamId: string, zone: Zone, won: number, setDiff = 0): StandingRow {
  return {
    teamId,
    teamName: teamId.toUpperCase(),
    zone,
    played: won,
    won,
    lost: 0,
    setDiff,
    unresolvedTie: false,
  };
}

function groupMatch(p: {
  stage: string;
  a: string;
  b: string;
  winner?: string | null;
  resultStatus: "PENDING" | "WINNER_ONLY" | "COMPLETE";
}): {
  stage: string;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  resultStatus: string;
} {
  return {
    stage: p.stage,
    teamAId: p.a,
    teamBId: p.b,
    winnerId: p.winner ?? null,
    resultStatus: p.resultStatus,
  };
}

describe("POSITION_POINTS", () => {
  it("has exactly 10 entries", () => {
    assert.equal(POSITION_POINTS.length, 10);
  });
  it("maps to the official scale", () => {
    assert.deepEqual(POSITION_POINTS, [100, 80, 65, 50, 40, 40, 30, 25, 10, 10]);
  });
});

describe("positionPoints", () => {
  it("1st=100", () => assert.equal(positionPoints(1), 100));
  it("2nd=80", () => assert.equal(positionPoints(2), 80));
  it("3rd=65", () => assert.equal(positionPoints(3), 65));
  it("4th=50", () => assert.equal(positionPoints(4), 50));
  it("5th=40", () => assert.equal(positionPoints(5), 40));
  it("6th=40", () => assert.equal(positionPoints(6), 40));
  it("7th=30", () => assert.equal(positionPoints(7), 30));
  it("8th=25", () => assert.equal(positionPoints(8), 25));
  it("9th=10", () => assert.equal(positionPoints(9), 10));
  it("10th=10", () => assert.equal(positionPoints(10), 10));
  it("11th+=10 floor", () => assert.equal(positionPoints(11), 10));
  it("100th=10 floor", () => assert.equal(positionPoints(100), 10));
});

describe("computeFinalPositions", () => {
  it("returns empty when no FINAL result (not finished)", () => {
    const matches = [
      groupMatch({ stage: "FINAL", a: "tA1", b: "tB1", winner: null, resultStatus: "PENDING" }),
    ];
    const standings = { A: [row("tA1", A, 2)], B: [row("tB1", B, 1)] };
    const positions = computeFinalPositions(matches, standings);
    assert.equal(positions.length, 0);
  });

  it("1st = FINAL winner, 2nd = FINAL loser", () => {
    const matches = [
      groupMatch({ stage: "SEMIFINAL_1", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "SEMIFINAL_2", a: "tA2", b: "tB2", winner: "tB2", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "FINAL", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
    ];
    const standings = {
      A: [row("tA1", A, 2), row("tA2", A, 1)],
      B: [row("tB1", B, 2), row("tB2", B, 1)],
    };
    const positions = computeFinalPositions(matches, standings);
    assert.equal(positions.length, 4);
    assert.equal(positions[0].teamId, "tA1");
    assert.equal(positions[0].position, 1);
    assert.equal(positions[1].teamId, "tB1");
    assert.equal(positions[1].position, 2);
  });

  it("3rd/4th = semifinal losers ordered by setDiff desc", () => {
    // SEMIFINAL_1 loser = tB1 (setDiff 5), SEMIFINAL_2 loser = tA2 (setDiff 2)
    const matches = [
      groupMatch({ stage: "SEMIFINAL_1", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "SEMIFINAL_2", a: "tA2", b: "tB2", winner: "tB2", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "FINAL", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
    ];
    const standings = {
      A: [row("tA1", A, 2, 5), row("tA2", A, 1, 2)],
      B: [row("tB1", B, 2, 5), row("tB2", B, 1, 2)],
    };
    const positions = computeFinalPositions(matches, standings);
    assert.equal(positions.length, 4);
    // tB1 (setDiff 5) is 3rd, tA2 (setDiff 2) is 4th
    assert.equal(positions[2].teamId, "tB1", "higher setDiff = 3rd");
    assert.equal(positions[3].teamId, "tA2");
  });

  it("5th+ = non-bracket teams ordered by zone position then setDiff", () => {
    // 2-zone format: bracket has 4 teams (tA1, tB1, tA2, tB2)
    // Non-bracket teams: tC1 and tC2 in zone C
    const matches = [
      groupMatch({ stage: "SEMIFINAL_1", a: "tA1", b: "tB2", winner: "tA1", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "SEMIFINAL_2", a: "tB1", b: "tA2", winner: "tB1", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "FINAL", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
    ];
    const standings = {
      A: [row("tA1", A, 2, 5), row("tA2", A, 1, 2)],
      B: [row("tB1", B, 2, 5), row("tB2", B, 1, 2)],
      C: [row("tC1", C, 2, 3), row("tC2", C, 1, 1)],
    };
    const positions = computeFinalPositions(matches, standings);
    assert.equal(positions.length, 6);
    assert.equal(positions[4].teamId, "tC1", "zone C leader = 5th");
    assert.equal(positions[5].teamId, "tC2");
  });

  it("3rd/4th tie-break by team name then id", () => {
    const matches = [
      groupMatch({ stage: "SEMIFINAL_1", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "SEMIFINAL_2", a: "tA2", b: "tB2", winner: "tB2", resultStatus: "COMPLETE" }),
      groupMatch({ stage: "FINAL", a: "tA1", b: "tB1", winner: "tA1", resultStatus: "COMPLETE" }),
    ];
    // Both losers have same setDiff
    const standings = {
      A: [row("tA1", A, 2, 3), row("tA2", A, 1, 3)],
      B: [row("tB1", B, 2, 3), row("tB2", B, 1, 3)],
    };
    const positions = computeFinalPositions(matches, standings);
    assert.equal(positions.length, 4);
    // tA2 vs tB1 both have setDiff 3; tA2 < tB1 alphabetically
    assert.equal(positions[2].teamId, "tA2", "name tie-break gives tA2 3rd");
    assert.equal(positions[3].teamId, "tB1");
  });
});

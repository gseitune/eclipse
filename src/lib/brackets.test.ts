import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Zone } from "../generated/prisma/client";
import type { StandingRow } from "./standings";
import { bestSecond, buildBrackets, isGroupPhaseComplete } from "./brackets";

const A: Zone = "A";
const B: Zone = "B";
const C: Zone = "C";

function row(teamId: string, zone: Zone, won: number, setDiff = 0, unresolvedTie = false): StandingRow {
  return {
    teamId,
    teamName: teamId.toUpperCase(),
    zone,
    played: won,
    won,
    lost: 0,
    setDiff,
    unresolvedTie,
  };
}

describe("isGroupPhaseComplete", () => {
  it("is complete only when every group match has a result", () => {
    assert.equal(isGroupPhaseComplete(20, 19), false);
    assert.equal(isGroupPhaseComplete(20, 20), true);
  });
});

describe("bestSecond", () => {
  it("picks the strongest runner-up by wins then setDiff", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3, 2)],
      B: [row("b1", B, 4), row("b2", B, 3, 4)],
    };
    const second = bestSecond(standings);
    assert.equal(second?.teamId, "b2");
  });

  it("returns null when ANY runner-up is unresolved (organizer must resolve first)", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3, 0, true)],
      B: [row("b1", B, 4), row("b2", B, 3)],
    };
    const second = bestSecond(standings);
    assert.equal(second, null);
  });
});

describe("buildBrackets - 2 zones", () => {
  it("yields A1 vs B2 and B1 vs A2", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3)],
      B: [row("b1", B, 4), row("b2", B, 3)],
    };
    const { pairings, missing } = buildBrackets(standings);
    assert.deepEqual(missing, []);
    assert.deepEqual(pairings, [
      { stage: "SEMIFINAL_1", teamAId: "a1", teamBId: "b2" },
      { stage: "SEMIFINAL_2", teamAId: "b1", teamBId: "a2" },
    ]);
  });

  it("reports missing slots when a tie is unresolved", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3, 0, true)],
      B: [row("b1", B, 4), row("b2", B, 3)],
    };
    const { pairings, missing } = buildBrackets(standings);
    assert.deepEqual(pairings, []);
    assert.deepEqual(missing, ["A2"]);
  });
});

describe("buildBrackets - 3 zones", () => {
  it("yields A1 vs best second and B1 vs C1", () => {
    const standings = {
      A: [row("a1", A, 3), row("a2", A, 2, 3)],
      B: [row("b1", B, 3), row("b2", B, 2, 1)],
      C: [row("c1", C, 3), row("c2", C, 2, 0)],
    };
    const { pairings, missing } = buildBrackets(standings);
    assert.deepEqual(missing, []);
    assert.deepEqual(pairings, [
      { stage: "SEMIFINAL_1", teamAId: "a1", teamBId: "a2" },
      { stage: "SEMIFINAL_2", teamAId: "b1", teamBId: "c1" },
    ]);
  });

  it("reports missing when the best second is unresolved", () => {
    const standings = {
      A: [row("a1", A, 3), row("a2", A, 2, 3, true)],
      B: [row("b1", B, 3), row("b2", B, 2, 1)],
      C: [row("c1", C, 3), row("c2", C, 2, 0)],
    };
    const { pairings, missing } = buildBrackets(standings);
    assert.deepEqual(pairings, []);
    assert.deepEqual(missing, ["Best second"]);
  });
});
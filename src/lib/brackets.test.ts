import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Zone } from "../generated/prisma/client";
import type { StandingRow } from "./standings";
import { buildBrackets, isGroupPhaseComplete, selectBestSecond } from "./brackets";

const A: Zone = "A";
const B: Zone = "B";
const C: Zone = "C";

function row(teamId: string, zone: Zone, won: number, setDiff = 0, unresolvedTie = false, maleName: string | null = null, femaleName: string | null = null): StandingRow {
  return {
    teamId,
    teamName: teamId.toUpperCase(),
    zone,
    played: won,
    won,
    lost: 0,
    setDiff,
    maleName,
    femaleName,
    unresolvedTie,
  };
}

describe("isGroupPhaseComplete", () => {
  it("is complete only when every group match has a result", () => {
    assert.equal(isGroupPhaseComplete(20, 19), false);
    assert.equal(isGroupPhaseComplete(20, 20), true);
  });
});

describe("selectBestSecond", () => {
  it("picks the strongest runner-up by wins then setDiff (direct)", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3, 2)],
      B: [row("b1", B, 4), row("b2", B, 3, 4)],
      C: [row("c1", C, 4), row("c2", C, 3, 2)],
    };
    const selection = selectBestSecond(standings);
    assert.deepEqual(selection, { kind: "direct", teamId: "b2" });
  });

  it("generates a DESEMPATE match when exactly two seconds tie", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 2, 2)],
      B: [row("b1", B, 4), row("b2", B, 2, 2)],
      C: [row("c1", C, 4), row("c2", C, 2, 0)],
    };
    const selection = selectBestSecond(standings);
    assert.deepEqual(selection, { kind: "playoff", teamAId: "a2", teamBId: "b2" });
  });

  it("detects and reports 3+ seconds tied for the spot (blocked edge)", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 2, 2)],
      B: [row("b1", B, 4), row("b2", B, 2, 2)],
      C: [row("c1", C, 4), row("c2", C, 2, 2)],
    };
    const selection = selectBestSecond(standings);
    assert.deepEqual(selection, {
      kind: "blocked",
      teamIds: ["a2", "b2", "c2"],
    });
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

  it("reports missing slots when a zone lacks a runner-up", () => {
    const standings = {
      A: [row("a1", A, 4)],
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

  it("does NOT build while the best second is tied (desempate pending)", () => {
    const standings = {
      A: [row("a1", A, 3), row("a2", A, 2, 2)],
      B: [row("b1", B, 3), row("b2", B, 2, 2)],
      C: [row("c1", C, 3), row("c2", C, 2, 0)],
    };
    const { pairings, missing } = buildBrackets(standings);
    assert.deepEqual(pairings, [], "brackets wait for the desempate result");
    assert.deepEqual(missing, ["Best second (desempate)"]);
  });

  it("builds once the desempate winner resolves the second spot", () => {
    const standings = {
      A: [row("a1", A, 3), row("a2", A, 2, 2)],
      B: [row("b1", B, 3), row("b2", B, 2, 2)],
      C: [row("c1", C, 3), row("c2", C, 2, 0)],
    };
    const { pairings, missing } = buildBrackets(standings, {
      resolvedSecondId: "a2",
    });
    assert.deepEqual(missing, []);
    assert.deepEqual(pairings, [
      { stage: "SEMIFINAL_1", teamAId: "a1", teamBId: "a2" },
      { stage: "SEMIFINAL_2", teamAId: "b1", teamBId: "c1" },
    ]);
  });

  it("reports the 3+ blocked edge without breaking the flow", () => {
    const standings = {
      A: [row("a1", A, 3), row("a2", A, 2, 2)],
      B: [row("b1", B, 3), row("b2", B, 2, 2)],
      C: [row("c1", C, 3), row("c2", C, 2, 2)],
    };
    const { pairings, missing } = buildBrackets(standings);
    assert.deepEqual(pairings, []);
    assert.deepEqual(missing, ["Best second (3+ tied)"]);
  });
});

describe("buildBrackets - REPECHAJE format (2 zones)", () => {
  it("yields REPECHAJE_1 = A2 vs B3 and REPECHAJE_2 = B2 vs A3", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3), row("a3", A, 2)],
      B: [row("b1", B, 4), row("b2", B, 3), row("b3", B, 2)],
    };
    const { pairings, missing } = buildBrackets(standings, { format: "REPECHAJE" });
    assert.deepEqual(missing, []);
    assert.deepEqual(pairings, [
      { stage: "REPECHAJE_1", teamAId: "a2", teamBId: "b3" },
      { stage: "REPECHAJE_2", teamAId: "b2", teamBId: "a3" },
    ]);
  });

  it("reports missing slots when a zone lacks a 2nd or 3rd place", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3)],
      B: [row("b1", B, 4), row("b2", B, 3), row("b3", B, 2)],
    };
    const { pairings, missing } = buildBrackets(standings, { format: "REPECHAJE" });
    assert.deepEqual(pairings, []);
    assert.deepEqual(missing, ["A3"]);
  });
});
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Zone } from "../generated/prisma/client";
import type { StandingRow } from "./standings";
import { buildBrackets, buildCuartosBrackets, isGroupPhaseComplete, selectBestSecond, selectBestThird } from "./brackets";

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

describe("buildCuartosBrackets", () => {
  it("11 teams (4/4/3): 6 direct QF entrants + RE1 with two losing thirds + best 3rd in QF4", () => {
    const standings = {
      A: [row("a1", A, 5, 8), row("a2", A, 4, 5), row("a3", A, 3, 2), row("a4", A, 0, -5)],
      B: [row("b1", B, 5, 7), row("b2", B, 4, 3), row("b3", B, 2, 1), row("b4", B, 0, -6)],
      C: [row("c1", C, 5, 6), row("c2", C, 3, 2), row("c3", C, 1, -1)],
    };
    const { pairings, missing } = buildCuartosBrackets(standings);
    assert.deepEqual(missing, []);
    assert.deepEqual(pairings, [
      { stage: "REPECHAJE_1", teamAId: "b3", teamBId: "c3" },
      { stage: "CUARTOS_1", teamAId: "c1", teamBId: "a2" },
      { stage: "CUARTOS_2", teamAId: "a1", teamBId: "b2" },
      { stage: "CUARTOS_3", teamAId: "b1", teamBId: "c2" },
    ]);
  });

  it("best 3rd wins (higher won) advances directly to QF4 side", () => {
    const standings = {
      A: [row("a1", A, 5, 8), row("a2", A, 4, 5), row("a3", A, 4, 3), row("a4", A, 0, -5)],
      B: [row("b1", B, 5, 7), row("b2", B, 4, 3), row("b3", B, 2, 1), row("b4", B, 0, -6)],
      C: [row("c1", C, 5, 6), row("c2", C, 3, 2), row("c3", C, 2, -1)],
    };
    const { pairings, missing } = buildCuartosBrackets(standings);
    assert.deepEqual(missing, []);
    const re1 = pairings.find((p) => p.stage === "REPECHAJE_1");
    assert.ok(re1);
    assert.ok(
      (re1.teamAId === "b3" && re1.teamBId === "c3") ||
      (re1.teamAId === "c3" && re1.teamBId === "b3"),
      "RE1 has the two losing thirds (b3 and c3)",
    );
  });

  it("reports best_third_tie when two thirds are tied on won then setDiff", () => {
    const standings = {
      A: [row("a1", A, 5, 8), row("a2", A, 4, 5), row("a3", A, 3, 2), row("a4", A, 0, -5)],
      B: [row("b1", B, 5, 7), row("b2", B, 4, 5), row("b3", B, 3, 2), row("b4", B, 0, -6)],
      C: [row("c1", C, 5, 6), row("c2", C, 3, 1), row("c3", C, 2, -1)],
    };
    const { pairings, missing } = buildCuartosBrackets(standings);
    assert.deepEqual(pairings, []);
    assert.deepEqual(missing, ["Best third (3+ tied)"]);
  });

  it("reports missing when fewer than 3 zones", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3)],
      B: [row("b1", B, 4), row("b2", B, 3)],
    };
    const { pairings, missing } = buildCuartosBrackets(standings);
    assert.deepEqual(missing, [`CUARTOS needs 3 zones, got 2`]);
  });

  it("reports missing when team count is out of range", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3), row("a3", A, 2), row("a4", A, 1)],
      B: [row("b1", B, 4), row("b2", B, 3), row("b3", B, 2), row("b4", B, 1)],
      C: [row("c1", C, 4), row("c2", C, 3)],
    };
    const { pairings, missing } = buildCuartosBrackets(standings);
    assert.ok(missing.length > 0);
  });
});

describe("selectBestThird", () => {
  it("picks the strongest third by won then setDiff (direct)", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3), row("a3", A, 2, 1)],
      B: [row("b1", B, 4), row("b2", B, 3), row("b3", B, 2, 0)],
      C: [row("c1", C, 4), row("c2", C, 3), row("c3", C, 2, -1)],
    };
    const selection = selectBestThird(standings);
    assert.deepEqual(selection, { kind: "direct", teamId: "a3" });
  });

  it("returns blocked when two thirds are tied on won then setDiff", () => {
    const standings = {
      A: [row("a1", A, 4), row("a2", A, 3), row("a3", A, 2, 2)],
      B: [row("b1", B, 4), row("b2", B, 3), row("b3", B, 2, 2)],
      C: [row("c1", C, 4), row("c2", C, 3), row("c3", C, 1, 0)],
    };
    const selection = selectBestThird(standings);
    assert.deepEqual(selection, {
      kind: "blocked",
      teamIds: ["a3", "b3"],
    });
  });
});

describe("buildCuartosBrackets with an organizer-resolved best third", () => {
  // The single-set group format ties the thirds of two 4-team zones, so the
  // organizer names the best third and the repechage takes the other two.
  const tied = {
    A: [row("a1", A, 3), row("a2", A, 2), row("a3", A, 1, -1), row("a4", A, 0, -3)],
    B: [row("b1", B, 3), row("b2", B, 2), row("b3", B, 1, -1), row("b4", B, 0, -3)],
    C: [row("c1", C, 2), row("c2", C, 1), row("c3", C, 0, -2)],
  };

  it("stays blocked without a resolved third", () => {
    const result = buildCuartosBrackets(tied, { format: "CUARTOS" });
    assert.deepEqual(result.pairings, []);
    assert.ok(result.missing.length > 0, "tie blocks the bracket");
  });

  it("fills the repechage with the two thirds that lost the pick", () => {
    const result = buildCuartosBrackets(tied, {
      format: "CUARTOS",
      resolvedThirdId: "b3",
    });
    assert.deepEqual(result.missing, []);
    const re = result.pairings.find((p) => p.stage === "REPECHAJE_1");
    assert.ok(re, "repechage is filled");
    assert.deepEqual(
      [re!.teamAId, re!.teamBId].sort(),
      ["a3", "c3"],
      "repechage holds the two thirds that were not picked",
    );
    assert.ok(
      result.pairings.every((p) => {
        if (p.stage !== "CUARTOS_1" && p.stage !== "CUARTOS_2" && p.stage !== "CUARTOS_3") {
          return true;
        }
        return p.teamAId !== "b3" && p.teamBId !== "b3";
      }),
      "the picked third only enters at CUARTOS_4, which stays empty here",
    );
  });
});
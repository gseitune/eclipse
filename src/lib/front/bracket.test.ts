import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cascadeImpact,
  matchScore,
  groupBracketColumns,
} from "./bracket";
import type { MatchPublic, Stage } from "./types";

function match(
  stage: Stage,
  overrides: Partial<MatchPublic> = {},
): MatchPublic {
  return {
    id: `m-${stage}`,
    stage,
    zone: null,
    slot: 0,
    timeLabel: null,
    teamAId: null,
    teamBId: null,
    teamA: null,
    teamB: null,
    setFormat: null,
    sets: null,
    resultStatus: "PENDING",
    winnerId: null,
    winner: null,
    recordedAt: null,
    ...overrides,
  };
}

describe("matchScore", () => {
  it("returns null when there are no recorded sets (winner only)", () => {
    assert.equal(matchScore({ sets: null }), null);
    assert.equal(matchScore({ sets: [] }), null);
  });

  it("returns the points of the single set", () => {
    assert.deepEqual(matchScore({ sets: [{ teamA: 21, teamB: 15 }] }), {
      a: 21,
      b: 15,
    });
  });

  it("returns the sets won when two or more sets were played (final)", () => {
    assert.deepEqual(
      matchScore({
        sets: [
          { teamA: 21, teamB: 18 },
          { teamA: 19, teamB: 21 },
          { teamA: 15, teamB: 12 },
        ],
      }),
      { a: 2, b: 1 },
    );
  });

  it("counts a 2-0 sweep as two sets for the winner", () => {
    assert.deepEqual(
      matchScore({
        sets: [
          { teamA: 21, teamB: 12 },
          { teamA: 21, teamB: 17 },
        ],
      }),
      { a: 2, b: 0 },
    );
  });
});

describe("groupBracketColumns", () => {
  it("orders columns left to right, earliest round first and final last", () => {
    const columns = groupBracketColumns([
      match("FINAL"),
      match("SEMIFINAL_1"),
      match("SEMIFINAL_2"),
      match("CUARTOS_1"),
      match("REPECHAJE_1"),
    ]);

    assert.deepEqual(
      columns.map((c) => c.key),
      ["repechaje", "cuartos", "semis", "final"],
    );
    assert.equal(columns[2].groups[0].matches.length, 2);
  });

  it("skips rounds the format does not create", () => {
    const columns = groupBracketColumns([match("SEMIFINAL_1"), match("FINAL")]);
    assert.deepEqual(
      columns.map((c) => c.key),
      ["semis", "final"],
    );
  });

  it("keeps bronze inside the final column, as its own labelled group", () => {
    const columns = groupBracketColumns([
      match("FINAL"),
      match("BRONZE"),
      match("SEMIFINAL_1"),
    ]);
    const final = columns[columns.length - 1];

    assert.equal(final.key, "final");
    assert.deepEqual(
      final.groups.map((g) => g.label),
      ["Final", "3er y 4to puesto"],
    );
  });

  it("returns an empty list when there are no brackets", () => {
    assert.deepEqual(groupBracketColumns([]), []);
  });
});

describe("cascadeImpact", () => {
  const played = (stage: string, resultStatus: string = "COMPLETE") => ({
    stage,
    resultStatus,
  });

  it("clears only the dependent results a CUARTOS_1 correction invalidates", () => {
    const impact = cascadeImpact("CUARTOS_1", [
      played("SEMIFINAL_1"),
      played("SEMIFINAL_2"), // independent side: its result must survive
      played("BRONZE"),
      played("FINAL", "PENDING"), // not played yet: nothing to clear
    ]);
    assert.deepEqual(
      impact.cleared.map((r) => r.stage),
      ["SEMIFINAL_1", "BRONZE"],
    );
  });

  it("keeps the independent quarter untouched when correcting REPECHAJE_1", () => {
    const impact = cascadeImpact("REPECHAJE_1", [
      played("CUARTOS_1"),
      played("CUARTOS_2"),
    ]);
    assert.deepEqual(
      impact.cleared.map((r) => r.stage),
      ["CUARTOS_1"],
    );
  });

  it("clears every elimination result when a GROUPS match is corrected", () => {
    const impact = cascadeImpact("GROUPS", [
      played("CUARTOS_1"),
      played("SEMIFINAL_2", "WINNER_ONLY"),
      played("FINAL", "PENDING"),
    ]);
    assert.deepEqual(
      impact.cleared.map((r) => r.stage),
      ["CUARTOS_1", "SEMIFINAL_2"],
    );
  });

  it("returns an empty impact for FINAL and BRONZE corrections", () => {
    for (const stage of ["FINAL", "BRONZE"]) {
      const impact = cascadeImpact(stage, [
        played("FINAL"),
        played("BRONZE"),
      ]);
      assert.equal(impact.cleared.length, 0);
      assert.equal(impact.nulledStages.length, 0);
    }
  });

  it("lists the bracket slots re-seeded from the corrected result", () => {
    assert.deepEqual(cascadeImpact("CUARTOS_1", []).nulledStages, [
      "SEMIFINAL_1",
      "SEMIFINAL_2",
      "BRONZE",
      "FINAL",
    ]);
    assert.deepEqual(cascadeImpact("GROUPS", []).nulledStages.length, 10);
  });
});

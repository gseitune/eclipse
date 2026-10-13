import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchScore, groupBracketColumns } from "./bracket";
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

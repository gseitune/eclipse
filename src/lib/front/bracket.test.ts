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
/* ---------------------------------------------------------------------------
 * World-Cup-style bracket tree layout (spec S9 / E6).
 * Structure rules mirror the backend pairings; see src/lib/front/bracket.ts.
 * ------------------------------------------------------------------------- */

import {
  bracketLayoutMode,
  buildBracketTree,
  type BracketTreeNode,
} from "./bracket";

const mk = (stage: Stage): MatchPublic => ({
  id: `id-${stage}`,
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
  resultStatus: "WINNER_ONLY",
  winnerId: null,
  winner: null,
  recordedAt: null,
});

const stagesOf = (node: BracketTreeNode | null): string[] =>
  node === null ? [] : [node.stage, ...stagesOf(node.a), ...stagesOf(node.b)];

const cuartosPayload = (): MatchPublic[] => [
  mk("REPECHAJE_1"),
  mk("CUARTOS_1"),
  mk("CUARTOS_2"),
  mk("CUARTOS_3"),
  mk("CUARTOS_4"),
  mk("SEMIFINAL_1"),
  mk("SEMIFINAL_2"),
  mk("FINAL"),
];

describe("bracketLayoutMode", () => {
  it("reads cuartos even though that format also has a repechaje row", () => {
    assert.equal(
      bracketLayoutMode([mk("REPECHAJE_1"), mk("CUARTOS_1"), mk("FINAL")]),
      "cuartos",
    );
  });

  it("reads repechaje when there are no CUARTOS rows", () => {
    assert.equal(
      bracketLayoutMode([mk("REPECHAJE_1"), mk("REPECHAJE_2"), mk("FINAL")]),
      "repechaje",
    );
  });

  it("falls back to standard with only semifinals", () => {
    assert.equal(
      bracketLayoutMode([mk("SEMIFINAL_1"), mk("SEMIFINAL_2"), mk("FINAL")]),
      "standard",
    );
  });
});

describe("buildBracketTree", () => {
  it("cuartos: SF1 hangs from QF1 and QF4, SF2 from QF2 and QF3", () => {
    const tree = buildBracketTree(cuartosPayload());
    assert.equal(tree.mode, "cuartos");
    assert.equal(tree.left.stage, "SEMIFINAL_1");
    assert.equal(tree.left.a!.stage, "CUARTOS_1");
    assert.equal(tree.left.b!.stage, "CUARTOS_4");
    assert.equal(tree.right.stage, "SEMIFINAL_2");
    assert.equal(tree.right.a!.stage, "CUARTOS_2");
    assert.equal(tree.right.b!.stage, "CUARTOS_3");
  });

  it("cuartos: the repechaje feeds QF1 and only QF1", () => {
    const tree = buildBracketTree(cuartosPayload());
    assert.equal(tree.left.a!.b!.stage, "REPECHAJE_1");
    assert.equal(tree.left.a!.a, null);
    assert.equal(tree.right.a!.a, null);
    assert.equal(tree.right.a!.b, null);
  });

  it("repechaje: SF1 takes the RE2 winner and SF2 takes the RE1 winner", () => {
    const tree = buildBracketTree([
      mk("REPECHAJE_1"),
      mk("REPECHAJE_2"),
      mk("SEMIFINAL_1"),
      mk("SEMIFINAL_2"),
      mk("FINAL"),
    ]);
    assert.equal(tree.mode, "repechaje");
    assert.equal(tree.left.a, null);
    assert.equal(tree.left.b!.stage, "REPECHAJE_2");
    assert.equal(tree.right.b!.stage, "REPECHAJE_1");
  });

  it("keeps the skeleton when a round has not been created yet", () => {
    const tree = buildBracketTree([mk("FINAL")]);
    assert.equal(tree.mode, "standard");
    assert.equal(tree.left.stage, "SEMIFINAL_1");
    assert.equal(tree.left.match, null);
    assert.equal(tree.right.match, null);
  });

  it("draws an empty FINAL box when the FINAL row does not exist yet", () => {
    const tree = buildBracketTree([mk("SEMIFINAL_1"), mk("SEMIFINAL_2")]);
    assert.equal(tree.final, null);
    assert.equal(tree.left.match!.stage, "SEMIFINAL_1");
    assert.equal(tree.right.match!.stage, "SEMIFINAL_2");
  });

  it("keeps the shape with an empty payload", () => {
    const tree = buildBracketTree([]);
    assert.equal(tree.mode, "standard");
    assert.equal(tree.final, null);
    assert.equal(tree.left.stage, "SEMIFINAL_1");
    assert.equal(tree.left.match, null);
  });

  it("picks up the bronze match when the payload has one", () => {
    const bronze = mk("BRONZE");
    const tree = buildBracketTree([...cuartosPayload(), bronze]);
    assert.equal(tree.bronze, bronze);
  });

  it("cuartos: each side carries exactly its own column", () => {
    const tree = buildBracketTree(cuartosPayload());
    assert.deepEqual(stagesOf(tree.left).sort(), [
      "CUARTOS_1",
      "CUARTOS_4",
      "REPECHAJE_1",
      "SEMIFINAL_1",
    ]);
    assert.deepEqual(stagesOf(tree.right).sort(), [
      "CUARTOS_2",
      "CUARTOS_3",
      "SEMIFINAL_2",
    ]);
  });
});
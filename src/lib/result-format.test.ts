import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InvalidResultError,
  describeSetProblem,
  isValidFinalSet,
  resolveResultPayload,
  setCapFor,
  type ResultPayload,
} from "./result-format";

const TEAM_A = "t-a";
const TEAM_B = "t-b";

function resolve(
  stage: string,
  input: ResultPayload,
  teamAId: string = TEAM_A,
  teamBId: string = TEAM_B,
) {
  return resolveResultPayload(teamAId, teamBId, stage, input);
}

function invalid(p: { stage: string; input: ResultPayload; reason?: string }) {
  assert.throws(
    () => resolve(p.stage, p.input),
    (err: unknown) => {
      assert.ok(err instanceof InvalidResultError);
      assert.equal(err.status, 400);
      if (p.reason) assert.equal(err.reason, p.reason);
      return true;
    },
  );
}

describe("resolveResultPayload", () => {
  describe("SINGLE_21 (groups)", () => {
    it("accepts a winning set at 21 with a 2-point lead", () => {
      const result = resolve("GROUPS", {
        setFormat: "SINGLE_21",
        sets: [{ teamA: 21, teamB: 19 }],
      });
      assert.equal(result.resultStatus, "COMPLETE");
      assert.equal(result.winnerId, TEAM_A);
      assert.deepEqual(result.sets, [{ teamA: 21, teamB: 19 }]);
      assert.equal(result.setFormat, "SINGLE_21");
    });

    it("rejects 21-20 (win by 2 required)", () => {
      invalid({
        stage: "GROUPS",
        input: { setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 20 }] },
        reason: "invalid_set_score",
      });
    });

    it("accepts scores above the cap when the lead is 2 (22-20)", () => {
      const result = resolve("GROUPS", {
        setFormat: "SINGLE_21",
        sets: [{ teamA: 22, teamB: 20 }],
      });
      assert.equal(result.winnerId, TEAM_A);
    });

    it("rejects a set below the cap (20-18)", () => {
      invalid({
        stage: "GROUPS",
        input: { setFormat: "SINGLE_21", sets: [{ teamA: 20, teamB: 18 }] },
        reason: "invalid_set_score",
      });
    });

    it("rejects a single-set format given two sets", () => {
      invalid({
        stage: "GROUPS",
        input: {
          setFormat: "SINGLE_21",
          sets: [
            { teamA: 21, teamB: 19 },
            { teamA: 21, teamB: 18 },
          ],
        },
        reason: "invalid_set_count",
      });
    });

    it("rejects TWO_15_TIEBREAK in groups", () => {
      invalid({
        stage: "GROUPS",
        input: {
          setFormat: "TWO_15_TIEBREAK",
          sets: [
            { teamA: 15, teamB: 13 },
            { teamA: 15, teamB: 12 },
          ],
        },
        reason: "format_not_allowed_for_stage",
      });
    });
  });

  describe("TWO_15_TIEBREAK (semis)", () => {
    it("accepts a 2-set sweep", () => {
      const result = resolve("SEMIFINAL_1", {
        setFormat: "TWO_15_TIEBREAK",
        sets: [
          { teamA: 15, teamB: 13 },
          { teamA: 16, teamB: 14 },
        ],
      });
      assert.equal(result.resultStatus, "COMPLETE");
      assert.equal(result.winnerId, TEAM_A);
    });

    it("rejects 15-14 in a 15-cap format", () => {
      invalid({
        stage: "SEMIFINAL_1",
        input: {
          setFormat: "TWO_15_TIEBREAK",
          sets: [
            { teamA: 15, teamB: 14 },
            { teamA: 17, teamB: 15 },
          ],
        },
        reason: "invalid_set_score",
      });
    });

    it("accepts 16-14 (over-cap with a 2-point lead)", () => {
      const result = resolve("SEMIFINAL_1", {
        setFormat: "TWO_15_TIEBREAK",
        sets: [
          { teamA: 16, teamB: 14 },
          { teamA: 15, teamB: 11 },
        ],
      });
      assert.equal(result.winnerId, TEAM_A);
    });

    it("requires the third set after a 1-1 split", () => {
      invalid({
        stage: "SEMIFINAL_1",
        input: {
          setFormat: "TWO_15_TIEBREAK",
          sets: [
            { teamA: 15, teamB: 11 },
            { teamA: 11, teamB: 15 },
          ],
        },
        reason: "third_set_required",
      });
    });

    it("accepts a 2-1 decision with the mandatory third set", () => {
      const result = resolve("SEMIFINAL_1", {
        setFormat: "TWO_15_TIEBREAK",
        sets: [
          { teamA: 15, teamB: 11 },
          { teamA: 11, teamB: 15 },
          { teamA: 15, teamB: 12 },
        ],
      });
      assert.equal(result.resultStatus, "COMPLETE");
      assert.equal(result.winnerId, TEAM_A);
    });

    it("rejects a spurious third set after a 2-0 sweep", () => {
      invalid({
        stage: "SEMIFINAL_1",
        input: {
          setFormat: "TWO_15_TIEBREAK",
          sets: [
            { teamA: 15, teamB: 12 },
            { teamA: 15, teamB: 13 },
            { teamA: 17, teamB: 15 },
          ],
        },
        reason: "match_already_decided",
      });
    });

    it("rejects BEST_OF_3_21 in a semi", () => {
      invalid({
        stage: "SEMIFINAL_2",
        input: {
          setFormat: "BEST_OF_3_21",
          sets: [
            { teamA: 21, teamB: 18 },
            { teamA: 24, teamB: 22 },
          ],
        },
        reason: "format_not_allowed_for_stage",
      });
    });
  });

  describe("BEST_OF_3_21 (final)", () => {
    it("accepts a 2-0 sweep (cuts at 2 sets)", () => {
      const result = resolve("FINAL", {
        setFormat: "BEST_OF_3_21",
        sets: [
          { teamA: 21, teamB: 18 },
          { teamA: 22, teamB: 20 },
        ],
      });
      assert.equal(result.resultStatus, "COMPLETE");
      assert.equal(result.winnerId, TEAM_A);
    });

    it("accepts a 2-1 decision", () => {
      const result = resolve("FINAL", {
        setFormat: "BEST_OF_3_21",
        sets: [
          { teamA: 21, teamB: 18 },
          { teamA: 19, teamB: 21 },
          { teamA: 24, teamB: 22 },
        ],
      });
      assert.equal(result.winnerId, TEAM_A);
    });

    it("rejects a single set (best of 3 needs 2)", () => {
      invalid({
        stage: "FINAL",
        input: { setFormat: "BEST_OF_3_21", sets: [{ teamA: 21, teamB: 19 }] },
        reason: "invalid_set_count",
      });
    });

    it("rejects four sets (no set 4)", () => {
      invalid({
        stage: "FINAL",
        input: {
          setFormat: "BEST_OF_3_21",
          sets: [
            { teamA: 21, teamB: 18 },
            { teamA: 19, teamB: 21 },
            { teamA: 21, teamB: 17 },
            { teamA: 21, teamB: 19 },
          ],
        },
        reason: "invalid_set_count",
      });
    });

    it("rejects a third set after the match already reached 2-0", () => {
      invalid({
        stage: "FINAL",
        input: {
          setFormat: "BEST_OF_3_21",
          sets: [
            { teamA: 21, teamB: 18 },
            { teamA: 21, teamB: 19 },
            { teamA: 15, teamB: 21 },
          ],
        },
        reason: "match_already_decided",
      });
    });

    it("rejects 1-1 after two sets (no third means no decision)", () => {
      invalid({
        stage: "FINAL",
        input: {
          setFormat: "BEST_OF_3_21",
          sets: [
            { teamA: 21, teamB: 18 },
            { teamA: 17, teamB: 21 },
          ],
        },
        reason: "third_set_required",
      });
    });

    it("rejects SINGLE_21 in the final", () => {
      invalid({
        stage: "FINAL",
        input: { setFormat: "SINGLE_21", sets: [{ teamA: 21, teamB: 19 }] },
        reason: "format_not_allowed_for_stage",
      });
    });
  });

  describe("winner derivation and payload rules", () => {
    it("derives the winner from the sets and rejects a mismatching winnerId", () => {
      invalid({
        stage: "GROUPS",
        input: {
          setFormat: "SINGLE_21",
          sets: [{ teamA: 21, teamB: 19 }],
          winnerId: TEAM_B,
        },
        reason: "winner_id_mismatch",
      });
    });

    it("accepts a winnerId that agrees with the sets", () => {
      const result = resolve("GROUPS", {
        setFormat: "SINGLE_21",
        sets: [{ teamA: 21, teamB: 19 }],
        winnerId: TEAM_A,
      });
      assert.equal(result.winnerId, TEAM_A);
    });

    it("allows WINNER_ONLY in every knockout stage", () => {
      for (const stage of [
        "DESEMPATE",
        "REPECHAJE_1",
        "REPECHAJE_2",
        "CUARTOS_1",
        "CUARTOS_2",
        "CUARTOS_3",
        "CUARTOS_4",
        "SEMIFINAL_1",
        "SEMIFINAL_2",
        "BRONZE",
        "FINAL",
      ]) {
        const result = resolve(stage, { winnerId: TEAM_B });
        assert.equal(result.resultStatus, "WINNER_ONLY");
        assert.equal(result.winnerId, TEAM_B);
        assert.equal(result.sets, null);
        assert.equal(result.setFormat, null);
      }
    });

    it("rejects WINNER_ONLY in the zone phase (no metric left to order the zone)", () => {
      invalid({
        stage: "GROUPS",
        input: { winnerId: TEAM_A },
        reason: "winner_only_not_in_groups",
      });
    });

    it("rejects a winner that is not one of the teams", () => {
      invalid({
        stage: "GROUPS",
        input: { winnerId: "some-other-team" },
        reason: "invalid_winner",
      });
    });

    it("requires setFormat when sets are present", () => {
      invalid({
        stage: "GROUPS",
        input: { sets: [{ teamA: 21, teamB: 19 }] },
        reason: "set_format_required",
      });
    });

    it("rejects a payload with neither sets nor a winner", () => {
      invalid({ stage: "GROUPS", input: {}, reason: "missing_result" });
    });

    it("rejects non-integer or zero scores", () => {
      invalid({
        stage: "GROUPS",
        input: {
          setFormat: "SINGLE_21",
          sets: [{ teamA: 21.5, teamB: 19 }],
        },
        reason: "invalid_set_score",
      });
      invalid({
        stage: "GROUPS",
        input: { setFormat: "SINGLE_21", sets: [{ teamA: 0, teamB: 21 }] },
        reason: "invalid_set_score",
      });
    });
  });
});

/**
 * Intermedios plays two sets to 21 and, on a 1-1 split, a third set to 15: the
 * cap depends on the set position, not only on the format.
 */
describe("setCapFor (2x21 + tercero a 15)", () => {
  it("caps the first two sets at 21 and the third at 15", () => {
    assert.equal(setCapFor("TWO_21_TIEBREAK_15", 0), 21);
    assert.equal(setCapFor("TWO_21_TIEBREAK_15", 1), 21);
    assert.equal(setCapFor("TWO_21_TIEBREAK_15", 2), 15);
  });

  it("leaves the existing formats unchanged", () => {
    assert.equal(setCapFor("SINGLE_21", 0), 21);
    assert.equal(setCapFor("BEST_OF_3_21", 0), 21);
    assert.equal(setCapFor("BEST_OF_3_21", 2), 21);
    assert.equal(setCapFor("TWO_15_TIEBREAK", 0), 15);
    assert.equal(setCapFor("TWO_15_TIEBREAK", 2), 15);
  });
});

/**
 * The organizer fills the scoreboard set by set; these are the messages that
 * stop an incomplete match from being submitted.
 */
describe("describeSetProblem", () => {
  const one = (a: number, b: number) => ({ teamA: a, teamB: b });

  it("accepts a single valid set for SINGLE_21", () => {
    assert.equal(describeSetProblem("SINGLE_21", [one(21, 19)]), null);
  });

  it("asks for the first set when nothing is loaded", () => {
    assert.match(describeSetProblem("SINGLE_21", []) ?? "", /set/i);
  });

  it("asks for the second set in a two-set format", () => {
    assert.match(
      describeSetProblem("TWO_21_TIEBREAK_15", [one(21, 19)]) ?? "",
      /segundo/i,
    );
  });

  it("requires the third set when the first two split 1-1", () => {
    assert.match(
      describeSetProblem("TWO_21_TIEBREAK_15", [one(21, 19), one(18, 21)]) ?? "",
      /tercer/i,
    );
  });

  it("accepts a 2-0 sweep without a third set", () => {
    assert.equal(
      describeSetProblem("TWO_21_TIEBREAK_15", [one(21, 19), one(21, 15)]),
      null,
    );
  });

  it("accepts a decided third set", () => {
    assert.equal(
      describeSetProblem("TWO_21_TIEBREAK_15", [
        one(21, 19),
        one(18, 21),
        one(15, 12),
      ]),
      null,
    );
  });

  it("rejects a third set without the 2-point lead", () => {
    assert.match(
      describeSetProblem("TWO_21_TIEBREAK_15", [
        one(21, 19),
        one(18, 21),
        one(15, 14),
      ]) ?? "",
      /2 de ventaja|2-point|ventaja/i,
    );
  });

  it("rejects a third set when the match was already decided", () => {
    assert.match(
      describeSetProblem("TWO_21_TIEBREAK_15", [
        one(21, 19),
        one(21, 15),
        one(15, 12),
      ]) ?? "",
      /ya/i,
    );
  });
});

/**
 * A set is won at the cap with a 2-point lead. Only a deuce can push it past
 * the cap, and there it always ends by exactly 2. Nothing above 30 is a real
 * score, so a typo like 10000-5 must be refused.
 */
describe("isValidFinalSet (21 con 2 de ventaja, deuce hasta 30)", () => {
  it("accepts a set closed at the cap with 2+ points of lead", () => {
    assert.equal(isValidFinalSet(21, 19, 21), true);
    assert.equal(isValidFinalSet(21, 5, 21), true);
    assert.equal(isValidFinalSet(15, 13, 15), true);
  });

  it("accepts a deuce that ends by exactly 2", () => {
    assert.equal(isValidFinalSet(22, 20, 21), true);
    assert.equal(isValidFinalSet(26, 24, 21), true);
    assert.equal(isValidFinalSet(30, 28, 21), true);
    assert.equal(isValidFinalSet(16, 14, 15), true);
  });

  it("rejects a set that never reached the cap", () => {
    assert.equal(isValidFinalSet(20, 18, 21), false);
    assert.equal(isValidFinalSet(14, 12, 15), false);
  });

  it("rejects a 1-point lead", () => {
    assert.equal(isValidFinalSet(21, 20, 21), false);
    assert.equal(isValidFinalSet(15, 14, 15), false);
  });

  it("rejects impossible big margins past the cap", () => {
    assert.equal(isValidFinalSet(25, 2, 21), false);
    assert.equal(isValidFinalSet(50, 10, 21), false);
    assert.equal(isValidFinalSet(43, 1, 21), false);
  });

  it("rejects anything above 30", () => {
    assert.equal(isValidFinalSet(31, 29, 21), false);
    assert.equal(isValidFinalSet(10000, 5, 21), false);
  });

  it("is wired into the payload validation", () => {
    assert.throws(
      () =>
        resolveResultPayload(TEAM_A, TEAM_B, "GROUPS", {
          setFormat: "SINGLE_21",
          sets: [{ teamA: 25, teamB: 2 }],
        }),
      /invalid/i,
    );
    assert.doesNotThrow(() =>
      resolveResultPayload(TEAM_A, TEAM_B, "GROUPS", {
        setFormat: "SINGLE_21",
        sets: [{ teamA: 26, teamB: 24 }],
      }),
    );
  });
});
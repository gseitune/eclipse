/**
 * SELVARENA result payload validation — multi-set model (ADDENDUM #1).
 *
 * Pure module, no I/O: the SAME validation used by recordResult and editResult
 * (PATCH re-recording), so a mis-typed score can always be fixed with the exact
 * payload rules the original load had to satisfy.
 *
 * Formats (defined by Andi):
 * - SINGLE_21       → 1 set to 21 (groups, and the DESEMPATE playoff).
 * - TWO_15_TIEBREAK → semis option 2x15; each set to 15, tie-break to 2;
 *                     a 1-1 split after two sets makes the third set (15)
 *                     MANDATORY to decide the winner.
 * - BEST_OF_3_21    → final: best of 3, first to 2 sets wins, cap 21; the
 *                     match cuts at 2 sets (a third set only exists after a
 *                     1-1 split; no set 4 is ever allowed).
 *
 * Set validation (win-by-2): a set closes at its cap WITH a 2-point lead, so
 * `high >= cap && high - low >= 2`. `15-14` and `21-20` are INVALID; `16-14`
 * and `22-20` are valid.
 *
 * The winner is ALWAYS derived from the sets; WINNER_ONLY remains legal in any
 * stage (no invented scores). A `winnerId` in the payload must agree with the
 * sets when both are present.
 */

export type SetFormatId = "SINGLE_21" | "TWO_15_TIEBREAK" | "BEST_OF_3_21";

export interface SetScore {
  teamA: number;
  teamB: number;
}

/** Payload accepted by recordResult and editResult (the API body surface). */
export interface ResultPayload {
  setFormat?: SetFormatId | null;
  /** Full scores, one entry per played set. Null for WINNER_ONLY. */
  sets?: SetScore[] | null;
  winnerId?: string | null;
}

export interface ResolvedResult {
  sets: SetScore[] | null;
  setFormat: SetFormatId | null;
  resultStatus: "COMPLETE" | "WINNER_ONLY";
  winnerId: string | null;
}

/** 400 error shaped like the back's BackError so API routes relay it. */
export class InvalidResultError extends Error {
  readonly status = 400;
  constructor(
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
  }
}

/** Stage → allowed set formats (chosen by the organizer at load time). */
export const STAGE_FORMATS: Record<string, readonly SetFormatId[]> = {
  GROUPS: ["SINGLE_21"],
  DESEMPATE: ["SINGLE_21"],
  SEMIFINAL_1: ["SINGLE_21", "TWO_15_TIEBREAK"],
  SEMIFINAL_2: ["SINGLE_21", "TWO_15_TIEBREAK"],
  FINAL: ["BEST_OF_3_21"],
};

const FORMAT_CAP: Record<SetFormatId, number> = {
  SINGLE_21: 21,
  TWO_15_TIEBREAK: 15,
  BEST_OF_3_21: 21,
};

function assertValidSet(score: SetScore, cap: number, index: number): void {
  const { teamA, teamB } = score;
  if (
    !Number.isInteger(teamA) ||
    !Number.isInteger(teamB) ||
    teamA <= 0 ||
    teamB <= 0
  ) {
    throw new InvalidResultError(
      `Set ${index + 1} must contain two positive integer scores.`,
      "invalid_set_score",
    );
  }
  const high = Math.max(teamA, teamB);
  const low = Math.min(teamA, teamB);
  if (high < cap || high - low < 2) {
    throw new InvalidResultError(
      `Set ${index + 1} is invalid: it must reach ${cap} with a 2-point lead (got ${teamA}-${teamB}).`,
      "invalid_set_score",
    );
  }
}

/** Single-source set counts; the winner is the side with more sets won. */
export function countSetWins(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const set of sets) {
    if (set.teamA > set.teamB) a += 1;
    else b += 1;
  }
  return { a, b };
}

/**
 * Resolves one result payload into what back.ts persists. Throws
 * InvalidResultError (400) with a reason on any rule violation.
 */
export function resolveResultPayload(
  teamAId: string,
  teamBId: string,
  stage: string,
  input: ResultPayload,
): ResolvedResult {
  const hasSets = input.sets !== null && input.sets !== undefined;

  if (hasSets) {
    const setFormat = input.setFormat;
    if (!setFormat) {
      throw new InvalidResultError(
        "setFormat is required when sets are provided.",
        "set_format_required",
      );
    }
    if (!STAGE_FORMATS[stage]?.includes(setFormat)) {
      throw new InvalidResultError(
        `setFormat ${setFormat} is not allowed for stage ${stage}.`,
        "format_not_allowed_for_stage",
      );
    }

    const { min, max } =
      setFormat === "SINGLE_21"
        ? { min: 1, max: 1 }
        : { min: 2, max: 3 };
    const count = input.sets!.length;
    if (count < min || count > max) {
      throw new InvalidResultError(
        `setFormat ${setFormat} expects ${min}-${max} sets (got ${count}).`,
        "invalid_set_count",
      );
    }

    const cap = FORMAT_CAP[setFormat];
    const sets = input.sets!;
    sets.forEach((set, index) => assertValidSet(set, cap, index));

    // Multi-set formats decide at 2 sets: the first two sets must either be
    // the same-winner sweep (2-set payload) or the 1-1 split that forces the
    // mandatory third set (3-set payload). Anything else contradicts the cut.
    if (setFormat !== "SINGLE_21") {
      const first2Same = (sets[0].teamA > sets[0].teamB) ===
        (sets[1].teamA > sets[1].teamB);
      if (sets.length === 2 && first2Same === false) {
        throw new InvalidResultError(
          `A ${setFormat} match cannot end 1-1: the third set is required to decide the winner.`,
          "third_set_required",
        );
      }
      if (sets.length === 3 && first2Same === true) {
        throw new InvalidResultError(
          `The match already reached 2 sets: no third set may be recorded (it cuts at 2).`,
          "match_already_decided",
        );
      }
    }

    const wins = countSetWins(sets);
    const winnerId = wins.a > wins.b ? teamAId : teamBId;
    if (input.winnerId && input.winnerId !== winnerId) {
      throw new InvalidResultError(
        "winnerId does not match the set scores.",
        "winner_id_mismatch",
      );
    }
    return { sets, setFormat, resultStatus: "COMPLETE", winnerId };
  }

  if (input.winnerId) {
    if (input.winnerId !== teamAId && input.winnerId !== teamBId) {
      throw new InvalidResultError(
        "winnerId must be one of the playing teams.",
        "invalid_winner",
      );
    }
    return {
      sets: null,
      setFormat: null,
      resultStatus: "WINNER_ONLY",
      winnerId: input.winnerId,
    };
  }

  throw new InvalidResultError(
    "Provide a full score (setFormat + sets) or an explicit winner — never a partial result.",
    "missing_result",
  );
}
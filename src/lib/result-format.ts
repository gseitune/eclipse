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
 * The winner is ALWAYS derived from the sets, so a COMPLETE result is the only
 * result the zone phase (GROUPS) accepts: with the winner alone, sets, point
 * difference and points for stay at zero for every team and a three-way tie can
 * never be ordered. WINNER_ONLY stays legal from the knockout stages on, where
 * the slot is decided by who advances. A `winnerId` in the payload must agree
 * with the sets when both are present.
 */

export type SetFormatId =
  | "SINGLE_21"
  | "TWO_15_TIEBREAK"
  | "TWO_21_TIEBREAK_15"
  | "BEST_OF_3_21";

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
  REPECHAJE_1: ["SINGLE_21"],
  REPECHAJE_2: ["SINGLE_21"],
  BRONZE: ["SINGLE_21"],
  SEMIFINAL_1: ["SINGLE_21", "TWO_15_TIEBREAK"],
  SEMIFINAL_2: ["SINGLE_21", "TWO_15_TIEBREAK"],
  FINAL: ["BEST_OF_3_21"],
  CUARTOS_1: ["SINGLE_21"],
  CUARTOS_2: ["SINGLE_21"],
  CUARTOS_3: ["SINGLE_21"],
  CUARTOS_4: ["SINGLE_21"],
};

/**
 * Cap of each set, by its position inside the match.
 *
 * TWO_21_TIEBREAK_15 is the Intermedios format: two sets to 21 and, when the
 * split is 1-1, a third set to 15. Every other format uses one cap for all its
 * sets, so they ignore the index.
 */
export function setCapFor(format: SetFormatId, index: number): number {
  if (format === "TWO_15_TIEBREAK") return 15;
  if (format === "TWO_21_TIEBREAK_15") return index >= 2 ? 15 : 21;
  return 21;
}

/** Hard ceiling for a set: a deuce cannot realistically reach this, and a
 *  typo like 10000-5 must never be accepted as a score. */
export const MAX_SET_POINTS = 30;

/**
 * A set closes at `cap` with a 2-point lead (21-19). Past the cap it only goes
 * on while tied, so it always ends by exactly 2 (22-20, 26-24, 30-28). Any
 * other combination is not a reachable score.
 */
export function isValidFinalSet(high: number, low: number, cap: number): boolean {
  if (high > MAX_SET_POINTS) return false;
  if (high < cap) return false;
  const diff = high - low;
  if (diff < 2) return false;
  if (high === cap) return true;
  return diff === 2 && low >= cap - 1;
}

/**
 * Human-facing reason why a set list cannot be submitted, or null when it can.
 *
 * Mirrors resolveResultPayload's rules so the organizer sees the problem while
 * typing instead of receiving a 400 after pressing the button.
 */
export function describeSetProblem(
  format: SetFormatId,
  sets: SetScore[],
): string | null {
  const single = format === "SINGLE_21";
  const min = single ? 1 : 2;
  const max = single ? 1 : 3;

  if (sets.length === 0) {
    return single ? "Cargá el set." : "Cargá los dos primeros sets.";
  }
  if (sets.length < min) return "Falta el segundo set.";
  if (sets.length > max) return "Son demasiados sets para este formato.";

  for (let i = 0; i < sets.length; i++) {
    const { teamA, teamB } = sets[i];
    if (
      !Number.isInteger(teamA) ||
      !Number.isInteger(teamB) ||
      teamA <= 0 ||
      teamB <= 0
    ) {
      return `Set ${i + 1}: cargá dos puntajes positivos.`;
    }
    const cap = setCapFor(format, i);
    const high = Math.max(teamA, teamB);
    const low = Math.min(teamA, teamB);
    if (!isValidFinalSet(high, low, cap)) {
      return `Set ${i + 1}: se gana a ${cap} con 2 de ventaja; si van ${cap - 1}-${cap - 1} sigue por 2 hasta ${MAX_SET_POINTS} (cargaste ${teamA}-${teamB}).`;
    }
  }

  if (!single) {
    const firstWinnerIsA = sets[0].teamA > sets[0].teamB;
    const split = firstWinnerIsA !== (sets[1].teamA > sets[1].teamB);
    if (split && sets.length === 2) return "Van 1-1: falta el tercer set.";
    if (!split && sets.length === 3) {
      return "El partido ya se definió en dos sets.";
    }
  }

  return null;
}

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
  if (!isValidFinalSet(high, low, cap)) {
    throw new InvalidResultError(
      `Set ${index + 1} is invalid: it must reach ${cap} with a 2-point lead, and past ${cap - 1}-${cap - 1} it continues by 2 up to ${MAX_SET_POINTS} (got ${teamA}-${teamB}).`,
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

/** Single-source point totals: the sum of every set's score per side. */
export function countSetPoints(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const set of sets) {
    a += set.teamA;
    b += set.teamB;
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
  /** Set format fixed by the etapa. When present it overrides the stage rules. */
  etapaSetFormat?: SetFormatId | null,
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
    const allowed: readonly SetFormatId[] = etapaSetFormat
      ? [etapaSetFormat]
      : (STAGE_FORMATS[stage] ?? []);
    if (!allowed.includes(setFormat)) {
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

    const sets = input.sets!;
    sets.forEach((set, index) =>
      assertValidSet(set, setCapFor(setFormat, index), index),
    );

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
    // Zone positions are ordered by merit (wins → sets → points), so a group
    // result without its set score leaves every team tied on 3 of the 4
    // criteria and the zone can only be resolved by hand. From the knockout
    // stages on, the slot only needs to know who advances.
    if (stage === "GROUPS") {
      throw new InvalidResultError(
        "Zone matches need the set score: a winner alone cannot order the zone.",
        "winner_only_not_in_groups",
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
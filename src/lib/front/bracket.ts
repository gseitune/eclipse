/**
 * Front-only helpers to present the knockout bracket.
 * No business rules — pure derivation from the public match shape.
 */

import type { MatchPublic, Stage } from "./types";
import { setWins } from "./types";
import { CASCADE_CLEAR_STAGES, CASCADE_NULL_TEAMS } from "../schedule";

export interface ScorePair {
  a: number;
  b: number;
}

/**
 * Public scoreboard for a bracket match, following the circuit rules:
 * - no recorded sets (winner only) -> null, the UI shows just the winner
 * - a single set (SINGLE_21)      -> the points of that set (e.g. 21-15)
 * - two or more sets (final, best of three) -> the sets won (e.g. 2-1)
 */
export function matchScore(
  match: Pick<MatchPublic, "sets">,
): ScorePair | null {
  const sets = match.sets ?? [];
  if (sets.length === 0) return null;
  if (sets.length === 1) return { a: sets[0].teamA, b: sets[0].teamB };
  return setWins(sets);
}

/**
 * Minimal row shape the cascade preview needs: the board row already carries
 * `stage` and `resultStatus` for every match, whether it has teams or not.
 */
export interface CascadeRow {
  stage: string;
  resultStatus: string;
}

export interface CascadeImpact<R extends CascadeRow = CascadeRow> {
  /**
   * Matches whose recorded result will be cleared by the correction (the
   * dependent phases of `stage` that already played).
   */
  cleared: R[];
  /**
   * Bracket slots that will be emptied and re-seeded from the corrected
   * result, even when some of them keep their result (e.g. the other semi).
   */
  nulledStages: readonly string[];
}

/**
 * Preview of what editing `stage` with `cascade: true` will invalidate,
 * derived from the SAME tables the backend uses (CASCADE_CLEAR_STAGES /
 * CASCADE_NULL_TEAMS), so the confirmation dialog can never promise more or
 * less than the transaction actually clears.
 */
export function cascadeImpact<R extends CascadeRow>(
  stage: string,
  rows: readonly R[],
): CascadeImpact<R> {
  const clearStages = CASCADE_CLEAR_STAGES[stage] ?? [];
  return {
    cleared: rows.filter(
      (row) =>
        clearStages.includes(row.stage) && row.resultStatus !== "PENDING",
    ),
    nulledStages: CASCADE_NULL_TEAMS[stage] ?? [],
  };
}

export interface BracketGroup {
  label: string;
  matches: MatchPublic[];
}

export interface BracketColumn {
  key: string;
  groups: BracketGroup[];
}

/**
 * Bracket columns in left-to-right order: earlier rounds on the left and the
 * final on the right. The third-place match rides in the final column, below
 * the final, as its own labelled group. Only rounds present in the data are
 * kept.
 */
const COLUMNS: {
  key: string;
  label: string;
  stages: Stage[];
  sideGroups?: { label: string; stages: Stage[] }[];
}[] = [
  {
    key: "repechaje",
    label: "Repechaje",
    stages: ["REPECHAJE_1", "REPECHAJE_2"],
  },
  {
    key: "cuartos",
    label: "Cuartos de final",
    stages: ["CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"],
  },
  {
    key: "semis",
    label: "Semifinales",
    stages: ["SEMIFINAL_1", "SEMIFINAL_2"],
  },
  {
    key: "final",
    label: "Final",
    stages: ["FINAL"],
    sideGroups: [{ label: "3er y 4to puesto", stages: ["BRONZE"] }],
  },
];

export function groupBracketColumns(
  brackets: MatchPublic[],
): BracketColumn[] {
  return COLUMNS.map((column) => {
    const groups = [
      { label: column.label, stages: column.stages },
      ...(column.sideGroups ?? []),
    ]
      .map((group) => ({
        label: group.label,
        matches: group.stages
          .map((stage) => brackets.find((b) => b.stage === stage))
          .filter((m): m is MatchPublic => m != null),
      }))
      .filter((group) => group.matches.length > 0);

    return { key: column.key, groups };
  }).filter((column) => column.groups.length > 0);
}

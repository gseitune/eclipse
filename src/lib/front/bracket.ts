/**
 * Front-only helpers to present the knockout bracket.
 * No business rules — pure derivation from the public match shape.
 */

import type { MatchPublic, Stage } from "./types";
import { setWins } from "./types";

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

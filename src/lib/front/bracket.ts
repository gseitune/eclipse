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
/* --------------------------------------------------------------------------
 * World-Cup-style bracket tree layout (spec S9 / E6).
 *
 * The public "Llaves" tab renders two mirrored trees that converge on the
 * FINAL. The structure is NOT inferred from results (a round that has not been
 * played yet would lose its boxes); it comes from a static spec that mirrors
 * the pairings the backend already uses:
 *
 *   cuartos   (brackets.ts:437-438, `getCuartosSemifinalPairings`)
 *             FINAL <- SF1, SF2 ; SF1 <- QF1, QF4 ; SF2 <- QF2, QF3 ;
 *             QF1's second slot <- REPECHAJE_1 winner
 *   repechaje (brackets.ts:369 / 401, `getRepechajePairings`)
 *             FINAL <- SF1, SF2 ; SF1 <- RE2 ; SF2 <- RE1
 *   standard  (brackets.ts:146-147 and 196-197)
 *             FINAL <- SF1, SF2 (semifinalists come straight from the groups)
 *
 * Every node is always emitted, even when the row does not exist yet, so the
 * bracket keeps its shape while a round is pending. `bronze` is rendered when
 * the payload has the row (the backend does not create it for the cuartos
 * format -- brackets.ts:442 -- but a legacy row may exist).
 * ------------------------------------------------------------------------ */

export type BracketLayoutMode = "cuartos" | "repechaje" | "standard";

export interface BracketTreeLinks {
  a?: Stage;
  b?: Stage;
}

export interface BracketTreeNode {
  stage: Stage;
  match: MatchPublic | null;
  a: BracketTreeNode | null;
  b: BracketTreeNode | null;
}

export interface BracketTree {
  mode: BracketLayoutMode;
  final: MatchPublic | null;
  left: BracketTreeNode;
  right: BracketTreeNode;
  bronze: MatchPublic | null;
}

const TREE_LINKS: Record<BracketLayoutMode, Partial<Record<Stage, BracketTreeLinks>>> = {
  cuartos: {
    FINAL: { a: "SEMIFINAL_1", b: "SEMIFINAL_2" },
    SEMIFINAL_1: { a: "CUARTOS_1", b: "CUARTOS_4" },
    SEMIFINAL_2: { a: "CUARTOS_2", b: "CUARTOS_3" },
    CUARTOS_1: { b: "REPECHAJE_1" },
  },
  repechaje: {
    FINAL: { a: "SEMIFINAL_1", b: "SEMIFINAL_2" },
    SEMIFINAL_1: { b: "REPECHAJE_2" },
    SEMIFINAL_2: { b: "REPECHAJE_1" },
  },
  standard: {
    FINAL: { a: "SEMIFINAL_1", b: "SEMIFINAL_2" },
  },
};

/**
 * Picks the layout from the stages present in the payload. CUARTOS_* wins over
 * REPECHAJE_* because the cuartos format also has a REPECHAJE_1 row.
 */
export function bracketLayoutMode(brackets: Pick<MatchPublic, "stage">[]): BracketLayoutMode {
  const stages = new Set(brackets.map((m) => m.stage));
  if (
    stages.has("CUARTOS_1") ||
    stages.has("CUARTOS_2") ||
    stages.has("CUARTOS_3") ||
    stages.has("CUARTOS_4")
  ) {
    return "cuartos";
  }
  if (stages.has("REPECHAJE_1") || stages.has("REPECHAJE_2")) return "repechaje";
  return "standard";
}

function indexByStage(brackets: MatchPublic[]): Map<Stage, MatchPublic> {
  const byStage = new Map<Stage, MatchPublic>();
  for (const match of brackets) {
    // First row wins; a duplicated stage should never happen.
    if (!byStage.has(match.stage)) byStage.set(match.stage, match);
  }
  return byStage;
}

function buildNode(
  stage: Stage,
  links: Partial<Record<Stage, BracketTreeLinks>>,
  byStage: Map<Stage, MatchPublic>,
  seen: Set<Stage>,
): BracketTreeNode {
  const branch: BracketTreeLinks = links[stage] ?? {};
  const nextSeen = new Set(seen);
  nextSeen.add(stage);
  const child = (childStage?: Stage) =>
    childStage && !nextSeen.has(childStage)
      ? buildNode(childStage, links, byStage, nextSeen)
      : null;
  return {
    stage,
    match: byStage.get(stage) ?? null,
    a: child(branch.a),
    b: child(branch.b),
  };
}

export function buildBracketTree(brackets: MatchPublic[]): BracketTree {
  const mode = bracketLayoutMode(brackets);
  const links = TREE_LINKS[mode];
  const byStage = indexByStage(brackets);
  const seen = new Set<Stage>();
  return {
    mode,
    final: byStage.get("FINAL") ?? null,
    left: buildNode("SEMIFINAL_1", links, byStage, seen),
    right: buildNode("SEMIFINAL_2", links, byStage, seen),
    bronze: byStage.get("BRONZE") ?? null,
  };
}
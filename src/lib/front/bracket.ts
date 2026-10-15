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
 * World-Cup-style bracket layout (spec S9 / E6).
 *
 * The public "Llaves" tab draws the bracket as fixed columns that fit the
 * phone width with no horizontal scrolling:
 *
 *   left   -> repechaje on top of the cuartos boxes
 *   middle -> semifinals
 *   right  -> final, with the 3rd/4th place match below it
 *
 * The layout is NOT inferred from results: a round that has not been created
 * yet would lose its boxes. It comes from a static spec that mirrors the
 * pairings the backend already uses:
 *
 *   cuartos   (brackets.ts:437-438, `getCuartosSemifinalPairings`)
 *             FINAL <- SF1, SF2 ; SF1 <- QF1, QF4 ; SF2 <- QF2, QF3 ; QF1's
 *             second slot <- REPECHAJE_1 winner
 *   repechaje (brackets.ts:369 / 401, `getRepechajePairings`)
 *             FINAL <- SF1, SF2 ; SF1 <- RE2 ; SF2 <- RE1
 *   standard  (brackets.ts:146-147 and 196-197)
 *             FINAL <- SF1, SF2 (semifinalists come straight from the groups)
 *
 * Every slot is always emitted, even when its row does not exist yet, so the
 * bracket keeps its shape while a round is pending. Note that the backend does
 * not create a bronze match for the cuartos format (brackets.ts:442), but a
 * legacy row may exist, so the right column always shows the slot.
 * ------------------------------------------------------------------------ */

export type BracketLayoutMode = "cuartos" | "repechaje" | "standard";

export interface BracketSlot {
  stage: Stage;
  match: MatchPublic | null;
}

export interface BracketColumns {
  mode: BracketLayoutMode;
  left: BracketSlot[];
  middle: BracketSlot[];
  right: BracketSlot[];
}

const COLUMN_SLOTS: Record<
  BracketLayoutMode,
  { left: Stage[]; middle: Stage[]; right: Stage[] }
> = {
  cuartos: {
    left: ["REPECHAJE_1", "CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"],
    middle: ["SEMIFINAL_1", "SEMIFINAL_2"],
    right: ["FINAL", "BRONZE"],
  },
  repechaje: {
    left: ["REPECHAJE_1", "REPECHAJE_2"],
    middle: ["SEMIFINAL_1", "SEMIFINAL_2"],
    right: ["FINAL", "BRONZE"],
  },
  standard: {
    left: [],
    middle: ["SEMIFINAL_1", "SEMIFINAL_2"],
    right: ["FINAL", "BRONZE"],
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

/**
 * Every slot of every column, in display order. Slots stay in the result even
 * when the payload has no row for them, so the bracket keeps its shape.
 */
export function buildBracketColumns(brackets: MatchPublic[]): BracketColumns {
  const mode = bracketLayoutMode(brackets);
  const byStage = indexByStage(brackets);
  const slots = (stages: Stage[]): BracketSlot[] =>
    stages.map((stage) => ({ stage, match: byStage.get(stage) ?? null }));

  return {
    mode,
    left: slots(COLUMN_SLOTS[mode].left),
    middle: slots(COLUMN_SLOTS[mode].middle),
    right: slots(COLUMN_SLOTS[mode].right),
  };
}
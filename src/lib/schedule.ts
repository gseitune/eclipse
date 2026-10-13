import type { ResultStatus } from "../generated/prisma/client";
import type { SetFormatId, SetScore } from "./result-format";

/**
 * Dynamic estimated schedule (HORARIOS ESTIMADOS).
 *
 * The seed `timeLabel` is the base (scheduled). Once results exist, each
 * match has an estimate: the first pending match after a recorded result
 * starts at result time + prepMinutes; all later pending matches shift in
 * chain by matchMinutes. Pure: computed on read, never stored.
 */

export interface ScheduleMatchInput {
  id: string;
  slot: number;
  stage: string;
  timeLabel: string | null;
  /** Full multi-set score; null for PENDING and WINNER_ONLY matches. */
  sets: SetScore[] | null;
  setFormat: SetFormatId | null;
  resultStatus: ResultStatus;
  recordedAt: Date | null;
  manualStartAt?: string | null;
  manualEndAt?: string | null;
}

export interface ScheduleRow {
  id: string;
  slot: number;
  stage: string;
  /** Base scheduled window from the fixture, e.g. "10:00 - 10:20". */
  scheduled: string | null;
  /** ISO timestamp estimate; null while no result anchors the chain. */
  estimated: string | null;
  /** True when the estimate comes from an actual recorded result chain. */
  estimatedFromResult: boolean;
  /** Full multi-set score; null for PENDING and WINNER_ONLY matches. */
  sets: SetScore[] | null;
  setFormat: SetFormatId | null;
  /**
   * True when this match's result may be edited: it has a result AND no
   * strictly-descendant phase has played one yet (editing would invalidate
   * the bracket). FINAL is always editable once played.
   */
  editable: boolean;
  manualStartAt?: string | null;
  manualEndAt?: string | null;
}

/**
 * Stage → strictly-descendant stages. A descendant with a result closes the
 * current match for editing: changing it would invalidate the bracket.
 */
export const DESCENDANT_STAGES: Record<string, readonly string[]> = {
  GROUPS: ["DESEMPATE", "SEMIFINAL_1", "SEMIFINAL_2", "FINAL", "BRONZE", "REPECHAJE_1", "REPECHAJE_2", "CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"],
  DESEMPATE: ["SEMIFINAL_1", "SEMIFINAL_2", "FINAL", "BRONZE", "REPECHAJE_1", "REPECHAJE_2", "CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4"],
  SEMIFINAL_1: ["FINAL", "BRONZE"],
  SEMIFINAL_2: ["FINAL", "BRONZE"],
  REPECHAJE_1: ["CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4", "SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  REPECHAJE_2: ["SEMIFINAL_1", "FINAL", "BRONZE"],
  BRONZE: ["FINAL"],
  FINAL: [],
  CUARTOS_1: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_2: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_3: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_4: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
};

/** Editing guard, pure: a match is editable iff it has a result and no descendant phase has one. */
export function isEditableMatch(
  match: ScheduleMatchInput,
  all: ScheduleMatchInput[],
): boolean {
  if (match.resultStatus === "PENDING") return false;
  const descendants = DESCENDANT_STAGES[match.stage] ?? [];
  if (descendants.length === 0) return true;
  return !all.some(
    (x) => descendants.includes(x.stage) && x.resultStatus !== "PENDING",
  );
}

/**
 * Every elimination stage a cascade correction can touch. Shared by the
 * backend (which clears the chain) and the organizer UI (which previews the
 * chain before confirming), so the preview can never drift from behavior.
 */
export const CASCADE_ALL_ELIM: readonly string[] = [
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
];

/**
 * RESULTS cleared per edited stage when a cascade correction runs. Mirrors
 * real winner propagation, NOT the conservative DESCENDANT_STAGES guard:
 * correcting CUARTOS_1 invalidates SEMIFINAL_1 + BRONZE + FINAL but never the
 * independent SEMIFINAL_2.
 */
export const CASCADE_CLEAR_STAGES: Record<string, readonly string[]> = {
  GROUPS: CASCADE_ALL_ELIM,
  DESEMPATE: CASCADE_ALL_ELIM,
  REPECHAJE_1: ["CUARTOS_1", "SEMIFINAL_1", "BRONZE", "FINAL"],
  REPECHAJE_2: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_1: ["SEMIFINAL_1", "BRONZE", "FINAL"],
  CUARTOS_2: ["SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_3: ["SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_4: ["SEMIFINAL_1", "BRONZE", "FINAL"],
  SEMIFINAL_1: ["BRONZE", "FINAL"],
  SEMIFINAL_2: ["BRONZE", "FINAL"],
  BRONZE: [],
  FINAL: [],
};

/**
 * TEAM REFERENCES nulled per edited stage when a cascade correction runs. The
 * fill contract governs this: the CUARTOS branch only re-seeds both semis when
 * BOTH semi slots are empty (fillDescendantMatches), and the SEMIFINAL branch
 * only re-fills FINAL and BRONZE when both slots are empty. Cleared stages
 * therefore lose their teams, and RE1/QF edits must also empty the OTHER semi
 * even though its result survives, so the fill can re-derive both pairings.
 */
export const CASCADE_NULL_TEAMS: Record<string, readonly string[]> = {
  GROUPS: CASCADE_ALL_ELIM,
  DESEMPATE: CASCADE_ALL_ELIM,
  REPECHAJE_1: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  REPECHAJE_2: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_1: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_2: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_3: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  CUARTOS_4: ["SEMIFINAL_1", "SEMIFINAL_2", "BRONZE", "FINAL"],
  SEMIFINAL_1: ["BRONZE", "FINAL"],
  SEMIFINAL_2: ["BRONZE", "FINAL"],
  BRONZE: [],
  FINAL: [],
};

const MS = 60_000;

function toTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

/**
 * Computes, for every match (any stage), the estimated start window.
 *
 * The first recorded result (by slot) anchors: its next pending match starts
 * at recordedAt + prepMinutes, and each following pending match adds
 * matchMinutes. Pending matches BEFORE the first recorded result keep their
 * base schedule untouched (they stay as scheduled).
 */
export function computeSchedule(
  matches: ScheduleMatchInput[],
  prepMinutes: number,
  matchMinutes: number,
): ScheduleRow[] {
  const ordered = [...matches].sort((a, b) => a.slot - b.slot);

  const firstRecordedSlot = ordered.find(
    (m) => m.resultStatus !== "PENDING",
  )?.slot;

  const rows: ScheduleRow[] = [];
  let nextStart: Date | null = null;

  const editableByMatch = new Map(
    ordered.map((m) => [m.id, isEditableMatch(m, ordered)]),
  );

  for (const m of ordered) {
    const hasManual = m.manualStartAt != null;
    const manualWindow = hasManual ? formatManualWindow(m.manualStartAt as string, (m.manualEndAt as string | null) ?? null) : null;
    const scheduled = hasManual ? manualWindow : (m.timeLabel ?? null);

    if (firstRecordedSlot === undefined || m.slot <= firstRecordedSlot) {
      rows.push({
        id: m.id,
        slot: m.slot,
        stage: m.stage,
        scheduled,
        estimated: null,
        estimatedFromResult: false,
        sets: m.sets,
        setFormat: m.setFormat,
        editable: editableByMatch.get(m.id) ?? false,
        manualStartAt: m.manualStartAt ?? null,
        manualEndAt: m.manualEndAt ?? null,
      });
      continue;
    }

    if (nextStart === null) {
      const anchor = ordered.find(
        (x) => x.slot === firstRecordedSlot && x.recordedAt !== null,
      );
      if (!anchor?.recordedAt) {
        rows.push({
          id: m.id,
          slot: m.slot,
          stage: m.stage,
          scheduled,
          estimated: null,
          estimatedFromResult: false,
          sets: m.sets,
          setFormat: m.setFormat,
          editable: editableByMatch.get(m.id) ?? false,
          manualStartAt: m.manualStartAt ?? null,
          manualEndAt: m.manualEndAt ?? null,
        });
        continue;
      }
      nextStart = new Date(anchor.recordedAt.getTime() + prepMinutes * MS);
    }

    const start: Date = nextStart;
    const end: Date = new Date(start.getTime() + matchMinutes * MS);
    rows.push({
      id: m.id,
      slot: m.slot,
      stage: m.stage,
      scheduled,
      estimated: `${toTimeOnly(start.toISOString())} - ${toTimeOnly(end.toISOString())}`,
      estimatedFromResult: true,
      sets: m.sets,
      setFormat: m.setFormat,
      editable: editableByMatch.get(m.id) ?? false,
      manualStartAt: m.manualStartAt ?? null,
      manualEndAt: m.manualEndAt ?? null,
    });
    nextStart = end;
  }

  return rows;
}

function formatManualWindow(startIso: string, endIso: string | null): string | null {
  if (!startIso) return null;
  const start = toTimeOnly(startIso);
  const end = endIso ? toTimeOnly(endIso) : start;
  return `${start} - ${end}`;
}
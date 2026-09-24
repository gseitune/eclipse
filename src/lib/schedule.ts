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
}

/**
 * Stage → strictly-descendant stages. A descendant with a result closes the
 * current match for editing: changing it would invalidate the bracket.
 */
export const DESCENDANT_STAGES: Record<string, readonly string[]> = {
  GROUPS: ["DESEMPATE", "SEMIFINAL_1", "SEMIFINAL_2", "FINAL"],
  DESEMPATE: ["SEMIFINAL_1", "SEMIFINAL_2", "FINAL"],
  SEMIFINAL_1: ["FINAL"],
  SEMIFINAL_2: ["FINAL"],
  FINAL: [],
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
    if (firstRecordedSlot === undefined || m.slot <= firstRecordedSlot) {
      rows.push({
        id: m.id,
        slot: m.slot,
        stage: m.stage,
        scheduled: m.timeLabel ?? null,
        estimated: null,
        estimatedFromResult: false,
        sets: m.sets,
        setFormat: m.setFormat,
        editable: editableByMatch.get(m.id) ?? false,
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
          scheduled: m.timeLabel ?? null,
          estimated: null,
          estimatedFromResult: false,
          sets: m.sets,
          setFormat: m.setFormat,
          editable: editableByMatch.get(m.id) ?? false,
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
      scheduled: m.timeLabel ?? null,
      estimated: `${toTimeOnly(start.toISOString())} - ${toTimeOnly(end.toISOString())}`,
      estimatedFromResult: true,
      sets: m.sets,
      setFormat: m.setFormat,
      editable: editableByMatch.get(m.id) ?? false,
    });
    nextStart = end;
  }

  return rows;
}
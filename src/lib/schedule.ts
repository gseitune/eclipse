import type { ResultStatus } from "../generated/prisma/client";

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

  for (const m of ordered) {
    if (firstRecordedSlot === undefined || m.slot <= firstRecordedSlot) {
      rows.push({
        id: m.id,
        slot: m.slot,
        stage: m.stage,
        scheduled: m.timeLabel ?? null,
        estimated: null,
        estimatedFromResult: false,
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
    });
    nextStart = end;
  }

  return rows;
}
import type { ResultStatus } from "../generated/prisma/client";
import type { SetFormatId, SetScore } from "./result-format";

/**
 * Dynamic estimated schedule (HORARIOS ESTIMADOS).
 *
 * `timeLabel` is the base (scheduled). Once a result or a manual window exists,
 * every match gets an estimate: each played match pins the chain to what really
 * happened and later pending matches shift by `matchMinutes`. There is no
 * preparation gap, and all windows render in the tournament timezone.
 * Pure: computed on read, never stored.
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

/**
 * Tournament timezone. Every window is rendered in this zone so the server
 * (which runs in UTC on Vercel) and the browser agree. Using the process zone
 * shifted every window three hours in production, while local development in
 * Argentina looked correct and hid the bug.
 */
const TOURNAMENT_TZ = "America/Argentina/Buenos_Aires";

const HHMM = new Intl.DateTimeFormat("es-AR", {
  timeZone: TOURNAMENT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toTimeOnly(date: Date): string {
  const formatted = HHMM.format(date);
  // Some ICU builds render midnight as "24:00" instead of "00:00".
  return formatted === "24:00" ? "00:00" : formatted;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWindow(start: Date, end: Date): string {
  return `${toTimeOnly(start)} - ${toTimeOnly(end)}`;
}

/**
 * Computes the estimated window of every match.
 *
 * The anchor is real data, never a guessed start hour: a match with manual
 * times uses them, and a recorded match is assumed to have just ended, so its
 * window is [recordedAt - matchMinutes, recordedAt]. Every later pending match
 * chains from the previous window's end. Each newly loaded result re-anchors
 * the chain, so the agenda follows the pace of the day instead of drifting.
 *
 * There is no preparation gap: a match takes `matchMinutes` and the next one
 * starts immediately, which is how the day actually runs.
 *
 * Matches before the first anchored one have no estimate and keep their
 * fixture label (null for group matches, which carry no base time).
 */
export function computeSchedule(
  matches: ScheduleMatchInput[],
  matchMinutes: number,
): ScheduleRow[] {
  const ordered = [...matches].sort((a, b) => a.slot - b.slot);

  const editableByMatch = new Map(
    ordered.map((m) => [m.id, isEditableMatch(m, ordered)]),
  );

  const rows: ScheduleRow[] = [];
  // Start of the next unplayed match, once something anchors the day.
  let nextStart: Date | null = null;

  for (const m of ordered) {
    const manualStart = parseDate(m.manualStartAt);
    const manualEnd = parseDate(m.manualEndAt);
    const scheduled = manualStart
      ? formatWindow(manualStart, manualEnd ?? new Date(manualStart.getTime() + matchMinutes * MS))
      : (m.timeLabel ?? null);

    let estimated: string | null = null;

    if (manualStart) {
      const end = manualEnd ?? new Date(manualStart.getTime() + matchMinutes * MS);
      estimated = formatWindow(manualStart, end);
      nextStart = end;
    } else if (m.recordedAt) {
      const end = m.recordedAt;
      const start = new Date(end.getTime() - matchMinutes * MS);
      estimated = formatWindow(start, end);
      nextStart = end;
    } else if (nextStart) {
      const start: Date = nextStart;
      const end: Date = new Date(start.getTime() + matchMinutes * MS);
      estimated = formatWindow(start, end);
      nextStart = end;
    }

    rows.push({
      id: m.id,
      slot: m.slot,
      stage: m.stage,
      scheduled,
      estimated,
      estimatedFromResult: estimated !== null,
      sets: m.sets,
      setFormat: m.setFormat,
      editable: editableByMatch.get(m.id) ?? false,
      manualStartAt: m.manualStartAt ?? null,
      manualEndAt: m.manualEndAt ?? null,
    });
  }

  return rows;
}

/**
 * Pure helper for detecting live matches from the schedule.
 * Front-only, no business logic.
 */

import type { ScheduleRow } from "./types";

/**
 * Parse a time string "HH:MM" into minutes-of-day.
 */
function minutesOfDay(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/**
 * Extract the start and end minutes from a schedule time field.
 * Accepts "HH:MM - HH:MM" ranges or a single "HH:MM" start.
 * Returns null if the field is null/empty.
 */
function parseWindow(
  field: string | null,
  matchMinutes: number,
): [number, number] | null {
  if (!field) return null;
  const trimmed = field.trim();
  if (trimmed.includes(" - ")) {
    const [start, end] = trimmed.split(" - ");
    return [minutesOfDay(start), minutesOfDay(end)];
  }
  const start = minutesOfDay(trimmed);
  return [start, start + matchMinutes];
}

/**
 * Return the set of match ids whose time window contains `nowMs`.
 *
 * - Prefers `estimated` over `scheduled` when both are present.
 * - Uses minute-of-day arithmetic (single-day tournament assumption).
 * - A match is live when start < now < end (strict containment).
 *
 * @param schedule - Schedule rows from the state.
 * @param matchMinutes - Default window length in minutes when only a start is given.
 * @param nowMs - Optional override for the current time (ms since epoch), for testability.
 */
export function liveMatchIds(
  schedule: ScheduleRow[],
  matchMinutes: number = 20,
  nowMs?: number,
): Set<string> {
  const nowDate = new Date(nowMs ?? Date.now());
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const matchMin = matchMinutes ?? 20;
  const live = new Set<string>();

  for (const row of schedule) {
    const window = parseWindow(row.estimated ?? row.scheduled, matchMin);
    if (!window) continue;
    const [start, end] = window;
    if (start < nowMin && nowMin < end) {
      live.add(row.id);
    }
  }

  return live;
}

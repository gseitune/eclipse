/**
 * Pure time-estimate helper for manual match scheduling.
 * No Prisma imports, no IIFE, injectable clock (nowMs parameter).
 */

export interface TimeEstimate {
  tournamentStart: number;
  elapsedMs: number;
  remainingMs: number;
  estimatedEndAt: number;
  pendingCount: number;
  inProgressCount: number;
}

/**
 * Computes tournament time estimates based on manual start/end times.
 *
 * - Returns null if no row has manualStartAt.
 * - When present, returns elapsed/remaining/estimatedEndAt in milliseconds.
 *
 * @param rows - Array of match data with optional manual times and result status.
 * @param nowMs - Current time in milliseconds (injectable clock for testing).
 * @param defaultMs - Default duration in milliseconds for matches without times.
 */
export function computeTimeEstimate(
  rows: Array<{
    manualStartAt?: string | null;
    manualEndAt?: string | null;
    resultStatus: string;
  }>,
  nowMs: number,
  defaultMs: number,
): TimeEstimate | null {
  const hasManualStart = rows.some(
    (r) => r.manualStartAt !== undefined && r.manualStartAt !== null,
  );
  if (!hasManualStart) return null;

  const startMsValues = rows
    .filter((r) => r.manualStartAt !== undefined && r.manualStartAt !== null)
    .map((r) => new Date(r.manualStartAt!).getTime());
  const tournamentStart = Math.min(...startMsValues);
  const elapsedMs = nowMs - tournamentStart;

  let remainingMs = 0;
  let pendingCount = 0;
  let inProgressCount = 0;

  for (const row of rows) {
    if (row.resultStatus === "PENDING") {
      pendingCount++;
    }

    if (row.manualStartAt !== undefined && row.manualStartAt !== null && row.resultStatus !== "COMPLETE") {
      inProgressCount++;
    }

    if (row.resultStatus === "COMPLETE") {
      continue;
    }

    if (row.manualEndAt !== undefined && row.manualEndAt !== null) {
      const endMs = new Date(row.manualEndAt).getTime();
      remainingMs += Math.max(0, endMs - nowMs);
    } else if (row.manualStartAt !== undefined && row.manualStartAt !== null) {
      const startMs = new Date(row.manualStartAt).getTime();
      remainingMs += Math.max(0, defaultMs - (nowMs - startMs));
    } else {
      remainingMs += defaultMs;
    }
  }

  const estimatedEndAt = nowMs + remainingMs;

  return {
    tournamentStart,
    elapsedMs,
    remainingMs,
    estimatedEndAt,
    pendingCount,
    inProgressCount,
  };
}

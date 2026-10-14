/**
 * Write audit trail.
 *
 * A loaded tournament was wiped twice and the second time left no trace of who
 * wrote the rows: no app action can do it, so the only way to tell an app write
 * from an outside one is to record every app write with a timestamp.
 *
 * One greppable line per mutation, prefixed with `[AUDIT]`, emitted to stdout so
 * Vercel keeps it in the runtime logs. Searching `[AUDIT]` in the logs answers
 * "did the app write this row, and when".
 *
 * Two hard rules:
 * - It never throws. An audit failure must never break the write it describes.
 * - It never reads the database. It only serialises what the caller already has.
 */

export type AuditEvent = {
  /** Mutation that ran, e.g. "editResult" or "clearCascadeResults". */
  op: string;
  /** Etapa the write belongs to, when it is known. */
  etapaId?: string | null;
  /** Match the write targeted, when it targeted a single one. */
  matchId?: string | null;
  /** Bracket stage the write touched, when it touched one. */
  stage?: string | null;
  /** Rows the write affected, when the caller knows the count. */
  count?: number;
  /** Extra, already-safe context: flags, stages, field names. Never secrets. */
  detail?: Record<string, unknown>;
};

export function auditWrite(event: AuditEvent): void {
  try {
    const line = JSON.stringify({ ...event, at: new Date().toISOString() });
    console.log(`[AUDIT] ${line}`);
  } catch {
    // A logging failure must never break the write it describes.
  }
}

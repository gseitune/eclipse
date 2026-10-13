/**
 * Tabs policy for the public tournament card: when each tab unlocks and which
 * etapa the final-standings tab opens on (front logic only, no business rules).
 *
 * The two locks follow the tournament's own milestones:
 *   - bracket tab: only once the group stage is over (phase ELIMINATORIES);
 *   - final standings tab: only once the organizer closes the fecha
 *     (Etapa.closedAt, set by "finalizar etapa").
 * A locked tab is hidden from the viewer on purpose: showing an empty bracket
 * or another etapa's podium mid-tournament reads as wrong data.
 */

export type TournamentTabId = "grupos" | "llaves" | "final";

export interface TabLockContext {
  phase: string;
  etapaClosed: boolean;
}

export const BRACKET_LOCK_REASON = "Se habilita al terminar la fase de grupos";
export const FINAL_LOCK_REASON = "Se habilita al finalizar la etapa";

/**
 * Reason the tab stays locked, or null when it can be opened. The bracket tab
 * is keyed off phase ELIMINATORIES (not off "the bracket has a result"), so a
 * DESEMPATE — which is what actually decides who enters the bracket — still
 * keeps it closed. Unknown phases fail closed.
 */
export function tabLockReason(
  tab: TournamentTabId,
  ctx: TabLockContext,
): string | null {
  switch (tab) {
    case "grupos":
      return null;
    case "llaves":
      return ctx.phase === "ELIMINATORIES" ? null : BRACKET_LOCK_REASON;
    case "final":
      return ctx.etapaClosed ? null : FINAL_LOCK_REASON;
  }
}

/**
 * Etapa the final-standings tab opens on: the one being viewed, then the last
 * one with published positions, then the first in the list. Null when the
 * ranking carries no etapas at all.
 */
export function pickDefaultEtapa<
  T extends { id: string; finished: boolean; positions: readonly unknown[] },
>(etapas: readonly T[], currentEtapaId: string | null): T | null {
  if (etapas.length === 0) return null;

  if (currentEtapaId !== null) {
    const current = etapas.find((e) => e.id === currentEtapaId);
    if (current) return current;
  }

  for (let i = etapas.length - 1; i >= 0; i--) {
    const e = etapas[i];
    if (e.finished && e.positions.length > 0) return e;
  }

  return etapas[0];
}

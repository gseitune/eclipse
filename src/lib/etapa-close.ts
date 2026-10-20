import type { EtapaMeta, MatchPublic } from "./front/types";

/** Mutually exclusive banner states for the "Finalizar etapa" action. */
export type CloseEtapaUi = "closed" | "locked" | "ready";

/**
 * How long the "Etapa finalizada" confirmation stays on screen after the etapa
 * is closed. It is a transient receipt, not a permanent state: once the window
 * is over the organizer panel shows no banner at all.
 */
export const CLOSED_BANNER_MS = 15 * 60 * 1000;

/**
 * Whether the "Etapa finalizada" card should still be visible.
 *
 * The window starts at `closedAt` (server truth, so it survives a reload) and
 * lasts CLOSED_BANNER_MS. A slightly future `closedAt` — the client clock
 * lagging behind the server — keeps the card visible instead of swallowing the
 * confirmation. Missing or unparseable timestamps never show it.
 */
export function closedBannerVisible(
  closedAt: string | null | undefined,
  now: number,
): boolean {
  if (!closedAt) return false;
  const closed = Date.parse(closedAt);
  if (Number.isNaN(closed)) return false;
  return now - closed < CLOSED_BANNER_MS;
}

/**
 * Closing an etapa is irreversible, so the action only unlocks once the FINAL
 * match has a result. The banner has three states:
 * - "closed": the etapa already carries a `closedAt` (frozen, no more edits)
 * - "locked": the FINAL has no result yet, so there is nothing to close with
 * - "ready":  the FINAL has a result and the etapa is still open
 */
export function closeEtapaUi(
  etapa: Pick<EtapaMeta, "closedAt"> | null | undefined,
  brackets:
    | readonly Pick<MatchPublic, "stage" | "resultStatus">[]
    | null
    | undefined,
): CloseEtapaUi {
  if (etapa?.closedAt) return "closed";
  const finalMatch = (brackets ?? []).find((m) => m.stage === "FINAL");
  return finalMatch && finalMatch.resultStatus !== "PENDING" ? "ready" : "locked";
}

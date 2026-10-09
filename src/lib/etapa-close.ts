import type { EtapaMeta, MatchPublic } from "./front/types";

/** Mutually exclusive banner states for the "Finalizar etapa" action. */
export type CloseEtapaUi = "closed" | "locked" | "ready";

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

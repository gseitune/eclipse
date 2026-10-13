import { BETA_COMMITS } from "./beta-commits";

/**
 * Number of git commits at the moment the public "BETA TEST" counter was
 * introduced. The badge shows `1.<commits since then + 1>`, so the number grows
 * by exactly one with every commit: 1.1, 1.2, 1.3, ...
 */
export const BETA_BASE_COMMITS = 151;

/** Pure formatter: maps a commit count to the public beta label. */
export function formatBetaVersion(commitCount: number): string {
  const count = Number.isFinite(commitCount) ? Math.trunc(commitCount) : BETA_BASE_COMMITS;
  return `1.${Math.max(1, count - BETA_BASE_COMMITS + 1)}`;
}

/**
 * Public beta label. The commit count comes from the committed counter in
 * ./beta-commits.ts, which .githooks/pre-commit advances on every commit.
 * Counting git history here was the previous approach and could not work in a
 * deploy: without a .git directory (or with a shallow clone) it always fell back
 * to the baseline label.
 */
export function betaVersion(): string {
  return formatBetaVersion(BETA_COMMITS);
}

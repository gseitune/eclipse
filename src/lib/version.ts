import { execSync } from "node:child_process";

/**
 * Number of git commits at the moment the public "BETA TEST" counter was
 * introduced. The badge shows `1.<commits since then + 1>`, so the number grows
 * by exactly one with every commit: 1.1, 1.2, 1.3, ...
 */
export const BETA_BASE_COMMITS = 151;

/** Pure formatter: maps a git commit count to the public beta label. */
export function formatBetaVersion(commitCount: number): string {
  const count = Number.isFinite(commitCount) ? Math.trunc(commitCount) : BETA_BASE_COMMITS;
  return `1.${Math.max(1, count - BETA_BASE_COMMITS + 1)}`;
}

/**
 * Server-only: reads the current commit count from git. Falls back to the
 * baseline label when git is unavailable (e.g. a deploy without a .git dir).
 * Do not import this from a "use client" component.
 */
export function betaVersion(): string {
  try {
    const out = execSync("git rev-list --count HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const count = Number.parseInt(out.trim(), 10);
    if (Number.isFinite(count) && count > 0) return formatBetaVersion(count);
  } catch {
    // git not available — fall through to the baseline
  }
  return formatBetaVersion(BETA_BASE_COMMITS);
}

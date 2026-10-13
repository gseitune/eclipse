#!/usr/bin/env node
/**
 * Bumps the committed beta counter in src/lib/beta-commits.ts.
 *
 * The public "BETA TEST 1.<n>" badge used to count git commits, but a Vercel
 * build has no usable history, so the badge stayed at the `1.1` baseline. The
 * number now lives in the repository and this script advances it by exactly one
 * per commit. It is invoked by .githooks/pre-commit, which also stages the
 * rewritten file so the new value ships with the commit it labels.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COUNTER_FILE = fileURLToPath(new URL("../src/lib/beta-commits.ts", import.meta.url));
const COUNTER_PATTERN = /(export const BETA_COMMITS = )(\d+)/;

/** Reads the counter from the generated module source, or null when absent. */
export function readCounter(source) {
  const match = COUNTER_PATTERN.exec(source);
  return match ? Number.parseInt(match[2], 10) : null;
}

/** Returns the source with the counter set to `value`, or null when absent. */
export function bump(source, value) {
  if (readCounter(source) === null) return null;
  return source.replace(COUNTER_PATTERN, (_match, prefix) => `${prefix}${value}`);
}

function main() {
  const source = readFileSync(COUNTER_FILE, "utf8");
  const current = readCounter(source);
  if (current === null) {
    console.error(`bump-beta: no BETA_COMMITS declaration in ${COUNTER_FILE}`);
    return 1;
  }

  const next = current + 1;
  const updated = bump(source, next);
  if (updated === null) {
    console.error("bump-beta: could not rewrite the counter");
    return 1;
  }

  writeFileSync(COUNTER_FILE, updated);
  console.log(`bump-beta: ${current} -> ${next}`);
  return 0;
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) process.exit(main());

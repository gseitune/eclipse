import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBetaVersion, BETA_BASE_COMMITS } from "./version";

test("baseline commit count maps to 1.1", () => {
  assert.equal(formatBetaVersion(BETA_BASE_COMMITS), "1.1");
});

test("every extra commit bumps the patch by one", () => {
  assert.equal(formatBetaVersion(BETA_BASE_COMMITS + 1), "1.2");
  assert.equal(formatBetaVersion(BETA_BASE_COMMITS + 2), "1.3");
  assert.equal(formatBetaVersion(BETA_BASE_COMMITS + 49), "1.50");
});

test("never goes below 1.1", () => {
  assert.equal(formatBetaVersion(BETA_BASE_COMMITS - 1), "1.1");
  assert.equal(formatBetaVersion(0), "1.1");
  assert.equal(formatBetaVersion(-5), "1.1");
});

test("non-finite input falls back to the baseline", () => {
  assert.equal(formatBetaVersion(Number.NaN), "1.1");
  assert.equal(formatBetaVersion(Number.POSITIVE_INFINITY), "1.1");
});

test("fractional counts are truncated", () => {
  assert.equal(formatBetaVersion(BETA_BASE_COMMITS + 1.9), "1.2");
});

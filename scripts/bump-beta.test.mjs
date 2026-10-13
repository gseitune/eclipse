import { test } from "node:test";
import assert from "node:assert/strict";
import { bump, readCounter } from "./bump-beta.mjs";

test("readCounter reads the generated value", () => {
  assert.equal(readCounter("export const BETA_COMMITS = 42;\n"), 42);
});

test("readCounter returns null when the declaration is missing", () => {
  assert.equal(readCounter("export const OTHER = 1;\n"), null);
});

test("bump rewrites only the counter value", () => {
  const source = "// header\nexport const BETA_COMMITS = 161;\n";
  assert.equal(bump(source, 162), "// header\nexport const BETA_COMMITS = 162;\n");
});

test("bump leaves the source untouched when the declaration is missing", () => {
  assert.equal(bump("export const OTHER = 1;\n", 2), null);
});

test("bump handles a counter that later grows a digit count", () => {
  assert.equal(bump("export const BETA_COMMITS = 99;\n", 100), "export const BETA_COMMITS = 100;\n");
});

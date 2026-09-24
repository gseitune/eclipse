import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectNewLive } from "./chime";

describe("detectNewLive", () => {
  it("returns empty array when next is a subset of prev", () => {
    const prev = new Set(["a", "b", "c"]);
    const next = new Set(["a", "b"]);
    assert.deepStrictEqual(detectNewLive(prev, next), []);
  });

  it("returns new IDs that appear in next but not in prev", () => {
    const prev = new Set(["a", "b"]);
    const next = new Set(["a", "b", "c"]);
    assert.deepStrictEqual(detectNewLive(prev, next), ["c"]);
  });

  it("returns all IDs when prev is empty", () => {
    const prev = new Set<string>();
    const next = new Set(["a", "b"]);
    assert.deepStrictEqual(detectNewLive(prev, next), ["a", "b"]);
  });

  it("returns empty array when both sets are identical", () => {
    const prev = new Set(["a", "b"]);
    const next = new Set(["a", "b"]);
    assert.deepStrictEqual(detectNewLive(prev, next), []);
  });

  it("returns empty array when both sets are empty", () => {
    const prev = new Set<string>();
    const next = new Set<string>();
    assert.deepStrictEqual(detectNewLive(prev, next), []);
  });

  it("preserves insertion order of next", () => {
    const prev = new Set(["a"]);
    const next = new Set(["c", "b", "a"]);
    assert.deepStrictEqual(detectNewLive(prev, next), ["c", "b"]);
  });

  it("returns all IDs when prev is empty and next has multiple", () => {
    const prev = new Set<string>();
    const next = new Set(["x", "y", "z"]);
    assert.deepStrictEqual(detectNewLive(prev, next), ["x", "y", "z"]);
  });
});

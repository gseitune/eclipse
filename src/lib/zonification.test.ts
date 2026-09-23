import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canSwapZones,
  regenerateZones,
  swapZone,
  zoneSizes,
} from "./zonification";

const alwaysZero = () => 0;

describe("canSwapZones", () => {
  it("allows swaps before confirmation and forbids after", () => {
    assert.equal(canSwapZones(false), true);
    assert.equal(canSwapZones(true), false);
  });
});

describe("swapZone", () => {
  const mapping = { t1: "A", t2: "A", t3: "B", t4: "B" } as const;

  it("moves a team between zones before confirmation", () => {
    const next = swapZone(mapping, "t1", "A", "B", false);
    assert.equal(next.t1, "B");
    assert.equal(mapping.t1, "A", "input mapping must not mutate");
    assert.equal(next.t2, "A");
  });

  it("REJECTS the swap after the fixture is confirmed (point of no return)", () => {
    assert.throws(
      () => swapZone(mapping, "t1", "A", "B", true),
      /confirmed/i,
    );
  });

  it("rejects wrong source zone or same-zone swaps", () => {
    assert.throws(() => swapZone(mapping, "t1", "B", "C", false), /zone A, not B/);
    assert.throws(() => swapZone(mapping, "t1", "A", "A", false), /same/);
    assert.throws(() => swapZone(mapping, "t9", "A", "B", false), /not assigned/);
  });
});

describe("regenerateZones", () => {
  const ids = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"];

  it("assigns every team exactly once with balanced sizes", () => {
    const mapping = regenerateZones(ids, Math.random);
    assert.equal(Object.keys(mapping).length, ids.length);
    for (const id of ids) assert.ok(mapping[id], `${id} must have a zone`);
    const sizes = zoneSizes(mapping);
    assert.ok(Math.abs(sizes.A - sizes.B) <= 1, "balanced A/B");
    assert.equal(sizes.C, 0, "10 teams -> 2 zones");
  });

  it("re-arm is repeatable as many times as wanted (different draws)", () => {
    const first = regenerateZones(ids, alwaysZero);
    const second = regenerateZones(ids, () => 0.99);
    assert.notDeepEqual(first, second, "each draw should differ");
    assert.equal(Object.keys(first).length, ids.length);
    assert.equal(Object.keys(second).length, ids.length);
  });

  it("works for 3 zones with balanced sizes", () => {
    const ids11 = [...ids, "t11"];
    const mapping = regenerateZones(ids11, alwaysZero);
    const sizes = zoneSizes(mapping);
    const all = sizes.A + sizes.B + sizes.C;
    assert.equal(all, 11);
    assert.ok(
      Math.max(sizes.A, sizes.B, sizes.C) -
        Math.min(sizes.A, sizes.B, sizes.C) <=
        1,
      "balanced 3 zones",
    );
  });
});
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ETAPA_MAX, ETAPA_MIN, availableEtapaNumbers } from "./etapa-numbers";

/**
 * The organizer picks the stage number from the gaps of the circuit, so a
 * skipped number can be loaded later (6 loaded → 1,2,3,4,5,7,8 offered).
 */
describe("availableEtapaNumbers", () => {
  it("offers the full range when nothing is loaded", () => {
    assert.deepEqual(availableEtapaNumbers([]), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("skips only the numbers already loaded", () => {
    assert.deepEqual(availableEtapaNumbers(["Etapa 6"]), [1, 2, 3, 4, 5, 7, 8]);
  });

  it("keeps the remaining gaps when several are loaded", () => {
    assert.deepEqual(availableEtapaNumbers(["Etapa 1", "Etapa 8"]), [2, 3, 4, 5, 6, 7]);
  });

  it("ignores names that are not 'Etapa N'", () => {
    assert.deepEqual(availableEtapaNumbers(["Final", "Etapa X", "Etapa 3"]), [
      1, 2, 4, 5, 6, 7, 8,
    ]);
  });

  it("returns an empty list when every number is taken", () => {
    const all = Array.from({ length: ETAPA_MAX - ETAPA_MIN + 1 }, (_, i) => `Etapa ${ETAPA_MIN + i}`);
    assert.deepEqual(availableEtapaNumbers(all), []);
  });

  it("ignores numbers outside 1..8", () => {
    assert.deepEqual(availableEtapaNumbers(["Etapa 0", "Etapa 9"]), [
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
});

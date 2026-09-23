import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isKnownPhase,
  phaseLabel,
  isEliminatories,
  needsBrackets,
  stageLabel,
  zoneName,
} from "./phase";

describe("isKnownPhase", () => {
  it("returns true for all known phases", () => {
    assert.equal(isKnownPhase("GROUPS"), true);
    assert.equal(isKnownPhase("DESEMPATE"), true);
    assert.equal(isKnownPhase("ELIMINATORIES"), true);
  });

  it("returns false for unknown phases", () => {
    assert.equal(isKnownPhase("QUARTERS"), false);
    assert.equal(isKnownPhase(""), false);
    assert.equal(isKnownPhase("FINAL"), false);
  });
});

describe("phaseLabel", () => {
  it("returns Spanish labels for known phases", () => {
    assert.equal(phaseLabel("GROUPS"), "Fase de grupos");
    assert.equal(phaseLabel("DESEMPATE"), "Desempate");
    assert.equal(phaseLabel("ELIMINATORIES"), "Eliminatorias");
  });

  it("returns generic label for unknown phase", () => {
    assert.equal(phaseLabel("QUARTERS"), "Fase en definición");
    assert.equal(phaseLabel(""), "Fase en definición");
    assert.equal(phaseLabel("anything"), "Fase en definición");
  });
});

describe("isEliminatories", () => {
  it("returns true only for ELIMINATORIES", () => {
    assert.equal(isEliminatories("ELIMINATORIES"), true);
    assert.equal(isEliminatories("GROUPS"), false);
    assert.equal(isEliminatories("DESEMPATE"), false);
  });
});

describe("needsBrackets", () => {
  it("returns false for GROUPS", () => {
    assert.equal(needsBrackets("GROUPS"), false);
  });

  it("returns true for DESEMPATE", () => {
    assert.equal(needsBrackets("DESEMPATE"), true);
  });

  it("returns true for ELIMINATORIES", () => {
    assert.equal(needsBrackets("ELIMINATORIES"), true);
  });

  it("returns true for unknown phases", () => {
    assert.equal(needsBrackets("QUARTERS"), true);
  });
});

describe("stageLabel", () => {
  it("returns Spanish labels for known stages", () => {
    assert.equal(stageLabel("GROUPS"), "Grupos");
    assert.equal(stageLabel("DESEMPATE"), "Desempate");
    assert.equal(stageLabel("SEMIFINAL_1"), "Semifinal 1");
    assert.equal(stageLabel("SEMIFINAL_2"), "Semifinal 2");
    assert.equal(stageLabel("FINAL"), "Final");
  });

  it("returns generic label for unknown stage", () => {
    assert.equal(stageLabel("QUARTERS"), "Partido");
    assert.equal(stageLabel(""), "Partido");
  });
});

describe("zoneName", () => {
  it("returns Spanish labels for known zones", () => {
    assert.equal(zoneName("A"), "Zona A");
    assert.equal(zoneName("B"), "Zona B");
    assert.equal(zoneName("C"), "Zona C");
  });

  it("returns generic label for unknown zone", () => {
    assert.equal(zoneName("D"), "Zona D");
    assert.equal(zoneName(""), "Zona ");
  });
});

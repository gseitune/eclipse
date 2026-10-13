import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tabLockReason, pickDefaultEtapa } from "./tabs";

describe("tabLockReason", () => {
  const open = { phase: "ELIMINATORIES", etapaClosed: true };

  it("never locks the group tab", () => {
    assert.equal(tabLockReason("grupos", open), null);
    assert.equal(
      tabLockReason("grupos", { phase: "GROUPS", etapaClosed: false }),
      null,
    );
    assert.equal(
      tabLockReason("grupos", { phase: "DESEMPATE", etapaClosed: false }),
      null,
    );
  });

  it("locks the bracket tab until the phase is ELIMINATORIES", () => {
    assert.equal(
      tabLockReason("llaves", { phase: "GROUPS", etapaClosed: false }),
      "Se habilita al terminar la fase de grupos",
    );
    assert.equal(
      tabLockReason("llaves", { phase: "DESEMPATE", etapaClosed: false }),
      "Se habilita al terminar la fase de grupos",
    );
    assert.equal(
      tabLockReason("llaves", { phase: "ELIMINATORIES", etapaClosed: false }),
      null,
    );
  });

  it("keeps the bracket tab locked on an unknown phase", () => {
    assert.equal(
      tabLockReason("llaves", { phase: "QUARTERS", etapaClosed: false }),
      "Se habilita al terminar la fase de grupos",
    );
  });

  it("locks the final standings tab until the etapa is closed", () => {
    assert.equal(
      tabLockReason("final", { phase: "ELIMINATORIES", etapaClosed: false }),
      "Se habilita al finalizar la etapa",
    );
    assert.equal(
      tabLockReason("final", { phase: "GROUPS", etapaClosed: false }),
      "Se habilita al finalizar la etapa",
    );
    assert.equal(
      tabLockReason("final", { phase: "ELIMINATORIES", etapaClosed: true }),
      null,
    );
  });

  it("locks each tab independently", () => {
    const ctx = { phase: "ELIMINATORIES", etapaClosed: false };
    assert.equal(tabLockReason("llaves", ctx), null);
    assert.equal(
      tabLockReason("final", ctx),
      "Se habilita al finalizar la etapa",
    );
  });
});

describe("pickDefaultEtapa", () => {
  const etapa = (id: string, finished: boolean, positions = 0) => ({
    id,
    finished,
    positions: Array.from({ length: positions }, (_, i) => ({ position: i + 1 })),
  });

  const etapas = [
    etapa("e1", true, 6),
    etapa("e3", true, 7),
    etapa("e6", false),
  ];

  it("picks the etapa the viewer is on", () => {
    assert.equal(pickDefaultEtapa(etapas, "e6")?.id, "e6");
    assert.equal(pickDefaultEtapa(etapas, "e1")?.id, "e1");
  });

  it("falls back to the last etapa with published positions", () => {
    assert.equal(pickDefaultEtapa(etapas, null)?.id, "e3");
    assert.equal(pickDefaultEtapa(etapas, "missing")?.id, "e3");
  });

  it("falls back to the first etapa when none has positions", () => {
    const fresh = [etapa("e6", false), etapa("e7", false)];
    assert.equal(pickDefaultEtapa(fresh, null)?.id, "e6");
  });

  it("returns null when there are no etapas", () => {
    assert.equal(pickDefaultEtapa([], "e6"), null);
  });
});

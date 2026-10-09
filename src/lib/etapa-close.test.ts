import assert from "node:assert/strict";
import test from "node:test";

import { closeEtapaUi } from "./etapa-close";
import type { ResultStatus, Stage } from "./front/types";

function match(stage: Stage, resultStatus: ResultStatus) {
  return { stage, resultStatus };
}

test("closeEtapaUi: locked when the bracket has no FINAL yet", () => {
  assert.equal(
    closeEtapaUi({ closedAt: null }, [match("SEMIFINAL_1", "WINNER_ONLY")]),
    "locked",
  );
});

test("closeEtapaUi: locked while the FINAL is still PENDING", () => {
  assert.equal(closeEtapaUi({ closedAt: null }, [match("FINAL", "PENDING")]), "locked");
});

test("closeEtapaUi: ready once the FINAL has a result", () => {
  assert.equal(
    closeEtapaUi({ closedAt: null }, [match("FINAL", "WINNER_ONLY")]),
    "ready",
  );
});

test("closeEtapaUi: closed wins even if the FINAL were pending", () => {
  assert.equal(
    closeEtapaUi({ closedAt: "2026-10-09T16:23:20.676Z" }, [match("FINAL", "PENDING")]),
    "closed",
  );
});

test("closeEtapaUi: tolerates missing state (SSR / first load)", () => {
  assert.equal(closeEtapaUi(null, null), "locked");
  assert.equal(closeEtapaUi(undefined, undefined), "locked");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  CLOSED_BANNER_MS,
  closeEtapaUi,
  closedBannerVisible,
} from "./etapa-close";
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

/* "Etapa finalizada" confirmation: shows right after closing and hides itself
 * 15 minutes later, so the organizer panel does not keep a permanent banner. */

const CLOSED_AT = "2026-10-13T14:22:10.667Z";
const closedMs = Date.parse(CLOSED_AT);

test("closedBannerVisible: shows right after the etapa is closed", () => {
  assert.equal(closedBannerVisible(CLOSED_AT, closedMs), true);
});

test("closedBannerVisible: still shows one millisecond before the 15 minutes", () => {
  assert.equal(closedBannerVisible(CLOSED_AT, closedMs + CLOSED_BANNER_MS - 1), true);
});

test("closedBannerVisible: hides exactly at 15 minutes", () => {
  assert.equal(closedBannerVisible(CLOSED_AT, closedMs + CLOSED_BANNER_MS), false);
});

test("closedBannerVisible: stays hidden long after the window", () => {
  assert.equal(closedBannerVisible(CLOSED_AT, closedMs + CLOSED_BANNER_MS * 100), false);
});

test("closedBannerVisible: never shows without a closedAt", () => {
  assert.equal(closedBannerVisible(null, closedMs), false);
  assert.equal(closedBannerVisible(undefined, closedMs), false);
});

test("closedBannerVisible: hides on an unparseable closedAt", () => {
  assert.equal(closedBannerVisible("not-a-date", closedMs), false);
});

test("closedBannerVisible: keeps the banner when the client clock lags behind", () => {
  assert.equal(closedBannerVisible(CLOSED_AT, closedMs - 2000), true);
});

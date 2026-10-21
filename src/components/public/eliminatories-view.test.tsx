import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EliminatoriesView } from "./EliminatoriesView";
import type { MatchPublic, Stage } from "@/lib/front/types";

function mk(stage: Stage, slot: number, id = `m-${stage}`): MatchPublic {
  return {
    id,
    stage,
    zone: null,
    slot,
    timeLabel: null,
    teamAId: "a",
    teamBId: "b",
    teamA: { id: "a", name: "Seba y Dana" },
    teamB: { id: "b", name: "Rami y Andy" },
    setFormat: "SINGLE_21",
    sets: null,
    resultStatus: "PENDING",
    winnerId: null,
    winner: null,
    recordedAt: null,
  };
}

const brackets: MatchPublic[] = [
  mk("REPECHAJE_1", 7, "re1"),
  mk("REPECHAJE_2", 8, "re2"),
  mk("SEMIFINAL_1", 9, "sf1"),
  mk("SEMIFINAL_2", 10, "sf2"),
  mk("BRONZE", 11, "br"),
  mk("FINAL", 12, "fi"),
];

const base = { brackets, phase: "ELIMINATORIES" };

describe("EliminatoriesView live indicator", () => {
  it("marks the live match with the EN VIVO strip and keeps the ember border", () => {
    const html = renderToStaticMarkup(
      <EliminatoriesView {...base} liveIds={new Set(["re1"])} />,
    );
    assert.ok(/En vivo/.test(html), "live match shows the strip");
    assert.equal(
      (html.match(/En vivo/g) ?? []).length,
      1,
      "only the live match gets the strip",
    );
    assert.ok(/animate-pulse/.test(html), "the strip carries the pulsing dot");
    assert.ok(/border-ember-500/.test(html), "the live box keeps the ember border");
  });

  it("renders no live marker when the stage provides an empty set (closed etapa)", () => {
    const html = renderToStaticMarkup(<EliminatoriesView {...base} liveIds={new Set()} />);
    assert.ok(!/En vivo/.test(html), "no strip without a live match");
    assert.ok(!/ember-500/.test(html), "no red border without a live match");
  });
});

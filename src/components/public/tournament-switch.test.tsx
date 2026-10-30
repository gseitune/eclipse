import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TournamentSwitch, CIRCUIT_LABELS } from "./TournamentSwitch";

const html = renderToStaticMarkup(
  <TournamentSwitch value="principiantes" onChange={() => {}} />,
);

describe("TournamentSwitch", () => {
  it("names the two circuit options", () => {
    assert.ok(html.includes("PRINCIPIANTE/INTERMEDIO"));
    assert.ok(html.includes("INTERMEDIO/AVANZADO"));
  });

  it("renders exactly two tabs and selects the current circuit", () => {
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  });

  it("exposes the same labels the hero headline reads", () => {
    assert.equal(CIRCUIT_LABELS.principiantes, "Principiante/Intermedio");
    assert.equal(CIRCUIT_LABELS.intermedios, "Intermedio/Avanzado");

    for (const label of Object.values(CIRCUIT_LABELS)) {
      assert.ok(html.includes(label.toUpperCase()));
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TournamentSwitch } from "./TournamentSwitch";

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
});

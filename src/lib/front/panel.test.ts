import { test } from "node:test";
import assert from "node:assert/strict";
import { sectionTargetId, sectionsFor } from "./panel";

test("the 'Crear Etapa' card opens the circuitos section", () => {
  assert.equal(sectionTargetId("Crear Etapa"), "circuitos");
});

test("the 'Agenda de partidos' card opens the reagendar section", () => {
  assert.equal(sectionTargetId("Agenda de partidos"), "reagendar");
});

test("unknown labels open nothing", () => {
  assert.equal(sectionTargetId("Equipos"), null);
  assert.equal(sectionTargetId("Resultados"), null);
  assert.equal(sectionTargetId(""), null);
});

test("default state: both sections actionable", () => {
  const sections = sectionsFor({ isCancelled: false, isClosed: false });
  assert.deepEqual(
    sections.map((s) => [s.label, s.kind]),
    [
      ["Crear Etapa", "actionable"],
      ["Agenda de partidos", "actionable"],
    ],
  );
});

test("closed etapa: Crear Etapa stays actionable, Agenda is disabled read-only", () => {
  const sections = sectionsFor({ isCancelled: false, isClosed: true });
  assert.deepEqual(
    sections.map((s) => [s.label, s.kind]),
    [
      ["Crear Etapa", "actionable"],
      ["Agenda de partidos", "disabled"],
    ],
  );
  const agenda = sections.find((s) => s.label === "Agenda de partidos");
  assert.match(agenda?.hint ?? "", /finalizada/);
});

test("cancelled etapa: Crear Etapa stays actionable, Agenda is disabled", () => {
  const sections = sectionsFor({ isCancelled: true, isClosed: false });
  assert.deepEqual(
    sections.map((s) => [s.label, s.kind]),
    [
      ["Crear Etapa", "actionable"],
      ["Agenda de partidos", "disabled"],
    ],
  );
});

test("cancelled wins over closed", () => {
  const sections = sectionsFor({ isCancelled: true, isClosed: true });
  const agenda = sections.find((s) => s.label === "Agenda de partidos");
  assert.equal(agenda?.kind, "disabled");
  assert.match(agenda?.hint ?? "", /cancelada/);
});

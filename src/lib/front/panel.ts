/**
 * Panel section policy for the organizer view: which cards exist, whether each
 * one is actionable or disabled, and where a click on it should land. Pure
 * logic only — no React, so the rules are testable on their own.
 *
 * The invariant worth keeping: "Crear Etapa" is ALWAYS actionable, even on a
 * cancelled or closed etapa, because building the next etapa is exactly what
 * the organizer does after one ends. Only the editing sections (Agenda) go
 * read-only, so a finished fecha can't be reshuffled after the podium.
 */

export type SectionKind = "actionable" | "disabled";
export type SectionTarget = "circuitos" | "reagendar";

export interface SectionConfig {
  readonly label: string;
  readonly hint: string;
  readonly kind: SectionKind;
}

export interface SectionFlags {
  readonly isCancelled: boolean;
  readonly isClosed: boolean;
}

export const CREATE_ETAPA_LABEL = "Crear Etapa";
export const AGENDA_LABEL = "Agenda de partidos";

/**
 * Which section a card label opens, or null when the label isn't navigable.
 * The label is the source of truth (it's what the card renders), so this must
 * match SectionConfig.label exactly — a stale label here silently makes a card
 * do nothing, which is the exact bug this function exists to pin.
 */
export function sectionTargetId(label: string): SectionTarget | null {
  switch (label) {
    case CREATE_ETAPA_LABEL:
      return "circuitos";
    case AGENDA_LABEL:
      return "reagendar";
    default:
      return null;
  }
}

export function sectionsFor(flags: SectionFlags): readonly SectionConfig[] {
  const agendaKind: SectionKind = flags.isCancelled || flags.isClosed ? "disabled" : "actionable";
  const agendaHint = flags.isCancelled
    ? "Etapa cancelada: sin acceso de edición"
    : flags.isClosed
      ? "Etapa finalizada: sólo consulta"
      : "Ver y modificar el orden de los partidos del día";

  return [
    {
      label: CREATE_ETAPA_LABEL,
      hint: "Crear y editar etapas con equipos",
      kind: "actionable",
    },
    {
      label: AGENDA_LABEL,
      hint: agendaHint,
      kind: agendaKind,
    },
  ];
}

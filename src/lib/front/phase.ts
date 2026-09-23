/**
 * Defensive phase helpers (front logic only, no business rules).
 */

export const KNOWN_PHASES = ["GROUPS", "DESEMPATE", "ELIMINATORIES"] as const;

export function isKnownPhase(p: string): boolean {
  return (KNOWN_PHASES as readonly string[]).includes(p);
}

export function phaseLabel(p: string): string {
  switch (p) {
    case "GROUPS":
      return "Fase de grupos";
    case "DESEMPATE":
      return "Desempate";
    case "ELIMINATORIES":
      return "Eliminatorias";
    default:
      return "Fase en definición";
  }
}

export function isEliminatories(p: string): boolean {
  return p === "ELIMINATORIES";
}

export function needsBrackets(p: string): boolean {
  return p !== "GROUPS";
}

export function stageLabel(stage: string): string {
  switch (stage) {
    case "GROUPS":
      return "Grupos";
    case "DESEMPATE":
      return "Desempate";
    case "SEMIFINAL_1":
      return "Semifinal 1";
    case "SEMIFINAL_2":
      return "Semifinal 2";
    case "FINAL":
      return "Final";
    default:
      return "Partido";
  }
}

export function zoneName(z: string): string {
  switch (z) {
    case "A":
      return "Zona A";
    case "B":
      return "Zona B";
    case "C":
      return "Zona C";
    default:
      return `Zona ${z}`;
  }
}

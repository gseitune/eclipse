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

export function isKnownStage(stage: string): boolean {
  const known = [
    "GROUPS", "DESEMPATE", "SEMIFINAL_1", "SEMIFINAL_2", "FINAL",
    "REPECHAJE_1", "REPECHAJE_2", "BRONZE",
    "CUARTOS_1", "CUARTOS_2", "CUARTOS_3", "CUARTOS_4",
  ];
  return (known as readonly string[]).includes(stage);
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
    case "REPECHAJE_1":
      return "Repechaje 1";
    case "REPECHAJE_2":
      return "Repechaje 2";
    case "BRONZE":
      return "3er y 4to puesto";
    case "CUARTOS_1":
      return "Cuartos 1";
    case "CUARTOS_2":
      return "Cuartos 2";
    case "CUARTOS_3":
      return "Cuartos 3";
    case "CUARTOS_4":
      return "Cuartos 4";
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

const KNOWN_ZONES = ["A", "B", "C"] as const;

export function isKnownZone(z: string): boolean {
  return (KNOWN_ZONES as readonly string[]).includes(z);
}

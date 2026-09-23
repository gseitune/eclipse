import type { Zone } from "../generated/prisma/client";
import type { StandingRow } from "./standings";

/**
 * Automatic eliminatories (ELIMINATORIAS AUTOMÁTICAS).
 *
 * Triggered when the LAST group-phase match gets a result. Brackets:
 *  - 2 zones: SEMIFINAL_1 = A1 vs B2, SEMIFINAL_2 = B1 vs A2.
 *  - 3 zones: top of each zone + BEST SECOND -> SEMIFINAL_1 = A1 vs best
 *    second, SEMIFINAL_2 = B1 vs C1.
 * The FINAL is the existing empty slot: its teams stay null until the
 * semifinals produce results. The phase flag flips GROUPS -> ELIMINATORIES.
 */

export type StandingsByZone = Partial<Record<Zone, StandingRow[]>>;

export interface BracketPairing {
  stage: "SEMIFINAL_1" | "SEMIFINAL_2";
  teamAId: string;
  teamBId: string;
}

export function isGroupPhaseComplete(
  groupMatchCount: number,
  decidedGroupMatches: number,
): boolean {
  return decidedGroupMatches >= groupMatchCount;
}

/**
 * Picks the best second (3-zone format): among the runners-up of every
 * zone, highest won, then setDiff, then name. Returns null when any zone
 * has an unresolved runner-up tie: we never silently drop a tied team —
 * the organizer must resolve every zone tie before the bracket is built.
 */
export function bestSecond(
  standings: StandingsByZone,
): StandingRow | null {
  const runnersUp: StandingRow[] = [];
  const zones = Object.keys(standings) as Zone[];
  for (const zone of zones) {
    const rows = standings[zone];
    if (!rows || rows.length < 2) return null;
    if (rows[1].unresolvedTie) return null;
    runnersUp.push(rows[1]);
  }
  if (runnersUp.length === 0) return null;
  return [...runnersUp].sort(
    (a, b) =>
      b.won - a.won ||
      b.setDiff - a.setDiff ||
      a.teamName.localeCompare(b.teamName),
  )[0];
}

/**
 * Resolves zone standings into bracket slots.
 * Returns pairings plus any missing slots (e.g. unresolved ties) that must
 * be resolved by the organizer before the bracket can be filled.
 */
export function buildBrackets(
  standings: StandingsByZone,
): { pairings: BracketPairing[]; missing: string[] } {
  const champion = (zone: Zone): StandingRow | null => {
    const rows = standings[zone];
    if (!rows || rows.length === 0) return null;
    return rows[0].unresolvedTie ? null : rows[0];
  };
  const runnerUp = (zone: Zone): StandingRow | null => {
    const rows = standings[zone];
    if (!rows || rows.length < 2) return null;
    return rows[1].unresolvedTie ? null : rows[1];
  };

  const zones = (Object.keys(standings) as Zone[]).filter((z) =>
    standings[z]?.some((r) => r.zone === z),
  );

  if (zones.length === 2) {
    const a1 = champion("A");
    const b1 = champion("B");
    const a2 = runnerUp("A");
    const b2 = runnerUp("B");
    const missing = [
      ...(!a1 ? ["A1"] : []),
      ...(!b1 ? ["B1"] : []),
      ...(!a2 ? ["A2"] : []),
      ...(!b2 ? ["B2"] : []),
    ];
    return {
      pairings:
        missing.length === 0
          ? [
              { stage: "SEMIFINAL_1", teamAId: a1!.teamId, teamBId: b2!.teamId },
              { stage: "SEMIFINAL_2", teamAId: b1!.teamId, teamBId: a2!.teamId },
            ]
          : [],
      missing,
    };
  }

  if (zones.length === 3) {
    const a1 = champion("A");
    const b1 = champion("B");
    const c1 = champion("C");
    const second = bestSecond(standings);
    const missing = [
      ...(!a1 ? ["A1"] : []),
      ...(!b1 ? ["B1"] : []),
      ...(!c1 ? ["C1"] : []),
      ...(!second ? ["Best second"] : []),
    ];
    return {
      pairings:
        missing.length === 0
          ? [
              { stage: "SEMIFINAL_1", teamAId: a1!.teamId, teamBId: second!.teamId },
              { stage: "SEMIFINAL_2", teamAId: b1!.teamId, teamBId: c1!.teamId },
            ]
          : [],
      missing,
    };
  }

  return {
    pairings: [],
    missing: [`Need 2 or 3 completed zones, got ${zones.length}`],
  };
}
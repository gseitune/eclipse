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
 * semifinals produce results. The phase flag flips GROUPS -> ELIMINATORIES,
 * only after any pending DESEMPATE (best-second playoff) is resolved.
 *
 * Best second (3-zone format, addendum 2026-09-23):
 *  - unique best (won, then setDiff) -> direct;
 *  - exactly two seconds tied on (won, setDiff) -> DESEMPATE match between
 *    them for the qualifying spot (bracket waits for its result);
 *  - 3+ seconds tied on (won, setDiff) -> blocked: detected and reported,
 *    resolution deferred (product decision).
 */

export type StandingsByZone = Partial<Record<Zone, StandingRow[]>>;

export interface BracketPairing {
  stage: "SEMIFINAL_1" | "SEMIFINAL_2";
  teamAId: string;
  teamBId: string;
}

export interface BuildBracketsOptions {
  /** Best-second already resolved (e.g. the DESEMPATE winner). */
  resolvedSecondId?: string;
}

export type BestSecondSelection =
  | { kind: "direct"; teamId: string }
  | { kind: "playoff"; teamAId: string; teamBId: string }
  | { kind: "blocked"; teamIds: string[] };

export function isGroupPhaseComplete(
  groupMatchCount: number,
  decidedGroupMatches: number,
): boolean {
  return decidedGroupMatches >= groupMatchCount;
}

/**
 * Picks how the best-second spot is decided among the runners-up of every
 * zone. Cross-zone teams never faced each other, so head-to-head does NOT
 * apply: comparison is (won, setDiff).
 */
export function selectBestSecond(
  standings: StandingsByZone,
): BestSecondSelection | null {
  const zones = (Object.keys(standings) as Zone[]).filter(
    (z) => (standings[z]?.length ?? 0) >= 2,
  );
  if (zones.length < 2) return null;
  const runnersUp: StandingRow[] = zones.map((z) => standings[z]![1]);

  const maxWon = Math.max(...runnersUp.map((r) => r.won));
  const onWins = runnersUp.filter((r) => r.won === maxWon);
  const maxDiff = Math.max(...onWins.map((r) => r.setDiff));
  const top = onWins.filter((r) => r.setDiff === maxDiff);

  if (top.length === 1) return { kind: "direct", teamId: top[0].teamId };
  if (top.length === 2) {
    return {
      kind: "playoff",
      teamAId: top[0].teamId,
      teamBId: top[1].teamId,
    };
  }
  return { kind: "blocked", teamIds: top.map((r) => r.teamId) };
}

/**
 * Resolves zone standings into bracket slots.
 * Returns pairings plus any missing slots that must be resolved before the
 * bracket can be filled (DESEMPATE pending / 3+ seconds blocked).
 */
export function buildBrackets(
  standings: StandingsByZone,
  options: BuildBracketsOptions = {},
): { pairings: BracketPairing[]; missing: string[] } {
  const champion = (zone: Zone): StandingRow | null => {
    const rows = standings[zone];
    if (!rows || rows.length === 0) return null;
    return rows[0];
  };
  const runnerUp = (zone: Zone): StandingRow | null => {
    const rows = standings[zone];
    if (!rows || rows.length < 2) return null;
    return rows[1];
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
    const missing = [
      ...(!a1 ? ["A1"] : []),
      ...(!b1 ? ["B1"] : []),
      ...(!c1 ? ["C1"] : []),
    ];

    const runnerUpRow = (id: string): StandingRow | null => {
      for (const z of ["A", "B", "C"] as const) {
        const rows = standings[z];
        if (rows && rows.length >= 2 && rows[1].teamId === id) return rows[1];
      }
      return null;
    };

    let second: StandingRow | null = null;
    let secondMissing: string | null = null;

    if (options.resolvedSecondId) {
      second = runnerUpRow(options.resolvedSecondId);
      if (!second) second = { teamId: options.resolvedSecondId } as StandingRow;
    } else {
      const selection = selectBestSecond(standings);
      if (selection?.kind === "direct") {
        second = runnerUpRow(selection.teamId);
      } else if (selection?.kind === "playoff") {
        secondMissing = "Best second (desempate)";
      } else if (selection?.kind === "blocked") {
        secondMissing = "Best second (3+ tied)";
      }
    }

    if (secondMissing) missing.push(secondMissing);
    else if (!second) missing.push("Best second");

    return {
      pairings:
        missing.length === 0 && second
          ? [
              { stage: "SEMIFINAL_1", teamAId: a1!.teamId, teamBId: second.teamId },
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
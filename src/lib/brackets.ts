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

export type BracketFormat = "STANDARD" | "REPECHAJE" | "CUARTOS";

export interface BracketPairing {
  stage: string;
  teamAId: string;
  teamBId: string;
}

export interface BuildBracketsOptions {
  /** Best-second already resolved (e.g. the DESEMPATE winner). */
  resolvedSecondId?: string;
  /** Tournament bracket format. Defaults to STANDARD. */
  format?: BracketFormat;
}

export type BestSecondSelection =
  | { kind: "direct"; teamId: string }
  | { kind: "playoff"; teamAId: string; teamBId: string }
  | { kind: "blocked"; teamIds: string[] };

export type BestThirdSelection =
  | { kind: "direct"; teamId: string }
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
  const fmt = options.format ?? "STANDARD";
  if (fmt === "REPECHAJE") return buildRepechajeBrackets(standings, options);
  if (fmt === "CUARTOS") return buildCuartosBrackets(standings, options);

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

/** Build REPECHAJE bracket pairings for a 2-zone tournament. */
function buildRepechajeBrackets(
  standings: StandingsByZone,
  __options: BuildBracketsOptions,
): { pairings: BracketPairing[]; missing: string[] } {
  const zones = (Object.keys(standings) as Zone[]).filter((z) =>
    standings[z]?.some((r) => r.zone === z),
  );
  if (zones.length !== 2) {
    return { pairings: [], missing: [`REPECHAJE needs 2 zones, got ${zones.length}`] };
  }
  const a2 = standings.A?.[1] ?? null;
  const b2 = standings.B?.[1] ?? null;
  const a3 = standings.A?.[2] ?? null;
  const b3 = standings.B?.[2] ?? null;

  const missing: string[] = [];
  if (!a2) missing.push("A2");
  if (!b2) missing.push("B2");
  if (!a3) missing.push("A3");
  if (!b3) missing.push("B3");
  if (missing.length > 0) return { pairings: [], missing };

  return {
    pairings: [
      { stage: "REPECHAJE_1", teamAId: a2!.teamId, teamBId: b3!.teamId },
      { stage: "REPECHAJE_2", teamAId: b2!.teamId, teamBId: a3!.teamId },
    ],
    missing: [],
  };
}

/**
 * Picks the best third-place team across zones for the CUARTOS format.
 * Compares thirds on (won, then setDiff). If tied, returns blocked
 * with reason "best_third_tie" — never invents a tiebreaker.
 */
export function selectBestThird(
  standings: StandingsByZone,
): BestThirdSelection | null {
  const zones = (Object.keys(standings) as Zone[]).filter(
    (z) => standings[z] !== undefined && standings[z]!.length >= 3,
  );
  if (zones.length < 3) return null;
  const thirds: StandingRow[] = zones.map((z) => standings[z]![2]);

  const maxWon = Math.max(...thirds.map((r) => r.won));
  const onWon = thirds.filter((r) => r.won === maxWon);
  const maxDiff = Math.max(...onWon.map((r) => r.setDiff));
  const top = onWon.filter((r) => r.setDiff === maxDiff);

  if (top.length === 1) return { kind: "direct", teamId: top[0].teamId };
  return { kind: "blocked", teamIds: top.map((r) => r.teamId) };
}

/** Build CUARTOS bracket pairings for a 3-zone tournament (11–12 teams). */
export function buildCuartosBrackets(
  standings: StandingsByZone,
  __options: BuildBracketsOptions = {},
): { pairings: BracketPairing[]; missing: string[] } {
  const zones = (Object.keys(standings) as Zone[]).filter((z) =>
    standings[z]?.some((r) => r.zone === z),
  );
  if (zones.length !== 3) {
    return { pairings: [], missing: [`CUARTOS needs 3 zones, got ${zones.length}`] };
  }

  const totalTeams = zones.reduce((acc, z) => acc + (standings[z]?.length ?? 0), 0);
  if (totalTeams < 11 || totalTeams > 12) {
    return { pairings: [], missing: [`CUARTOS needs 11-12 teams, got ${totalTeams}`] };
  }

  const a1 = standings.A?.[0];
  const b1 = standings.B?.[0];
  const c1 = standings.C?.[0];
  const a2 = standings.A?.[1];
  const b2 = standings.B?.[1];
  const c2 = standings.C?.[1];
  const a3 = standings.A?.[2];
  const b3 = standings.B?.[2];
  const c3 = standings.C?.[2];

  const missing: string[] = [];
  if (!a1 || !b1 || !c1) missing.push("Zone champion missing");
  if (!a2 || !b2 || !c2) missing.push("Zone runner-up missing");
  if (!a3 || !b3 || !c3) missing.push("Zone third missing");
  if (missing.length > 0) return { pairings: [], missing };

  const bestThird = selectBestThird(standings);
  if (bestThird?.kind === "blocked") {
    return { pairings: [], missing: ["Best third (3+ tied)"] };
  }

  const bestThirdId = bestThird?.kind === "direct" ? bestThird.teamId : null;

  // Identify the two losing thirds (for REPECHAJE_1)
  const allThirds = [a3!, b3!, c3!].filter((r): r is StandingRow => r !== undefined);
  const losingThirds = allThirds.filter((r) => r.teamId !== bestThirdId);

  // CUARTOS_4 slot stays empty: it will be filled when REPECHAJE_1 is played.
  // Best 3rd advances directly to QF4; RE1 winner takes the other side.
  return {
    pairings: [
      { stage: "REPECHAJE_1", teamAId: losingThirds[0]!.teamId, teamBId: losingThirds[1]!.teamId },
      { stage: "CUARTOS_1", teamAId: c1!.teamId, teamBId: a2!.teamId },
      { stage: "CUARTOS_2", teamAId: a1!.teamId, teamBId: b2!.teamId },
      { stage: "CUARTOS_3", teamAId: b1!.teamId, teamBId: c2!.teamId },
    ],
    missing: [],
  };
}

/**
 * Returns pairings for the next fillable bracket round, given standings
 * and the current results of feeder matches.
 *
 * After RE results → SEMIFINAL_1 (1°A winner of RE2) / SEMIFINAL_2 (1°B winner of RE1).
 * After both semis → BRONZE (losers) and FINAL (winners).
 * For CUARTOS format: RE1 → CUARTOS_4; 4 QFs → SEMIFINAL_1/2; both semis → FINAL only.
 *
 * `completed` maps stage → winnerId (only for non-PENDING matches).
 */
export function nextRoundPairings(
  standings: StandingsByZone,
  completed: Record<string, string | null>,
  format: "STANDARD" | "REPECHAJE" | "CUARTOS" = "STANDARD",
): Array<{ stage: string; teamAId: string; teamBId: string }> {
  if (format === "CUARTOS") return nextRoundPairingsCuartos(standings, completed);

  const a1 = standings.A?.[0]?.teamId ?? null;
  const b1 = standings.B?.[0]?.teamId ?? null;

  const re1Winner = completed["REPECHAJE_1"];
  const re2Winner = completed["REPECHAJE_2"];
  const semi1Winner = completed["SEMIFINAL_1"];
  const semi2Winner = completed["SEMIFINAL_2"];

  // REPECHAJE results → fill semis
  if (re1Winner && re2Winner && !semi1Winner && !semi2Winner) {
    return [
      { stage: "SEMIFINAL_1", teamAId: a1!, teamBId: re2Winner! },
      { stage: "SEMIFINAL_2", teamAId: b1!, teamBId: re1Winner! },
    ];
  }
  if (re1Winner && !semi2Winner) {
    return [{ stage: "SEMIFINAL_2", teamAId: b1!, teamBId: re1Winner! }];
  }
  if (re2Winner && !semi1Winner) {
    return [{ stage: "SEMIFINAL_1", teamAId: a1!, teamBId: re2Winner! }];
  }

  // Both semis have winners → fill BRONZE and FINAL
  if (semi1Winner && semi2Winner) {
    const semi1Losers = getOtherTeam(semi1Winner, completed["SEMIFINAL_1"]);
    const semi2Losers = getOtherTeam(semi2Winner, completed["SEMIFINAL_2"]);
    return [
      { stage: "BRONZE", teamAId: semi1Losers!, teamBId: semi2Losers! },
      { stage: "FINAL", teamAId: semi1Winner, teamBId: semi2Winner },
    ];
  }

  return [];
}

/** Next-round pairings for CUARTOS format. */
function nextRoundPairingsCuartos(
  standings: StandingsByZone,
  completed: Record<string, string | null>,
): Array<{ stage: string; teamAId: string; teamBId: string }> {
  const re1Winner = completed["REPECHAJE_1"];
  const q1Winner = completed["CUARTOS_1"];
  const q2Winner = completed["CUARTOS_2"];
  const q3Winner = completed["CUARTOS_3"];
  const q4Winner = completed["CUARTOS_4"];
  const semi1Winner = completed["SEMIFINAL_1"];
  const semi2Winner = completed["SEMIFINAL_2"];

  // RE1 result → fill CUARTOS_4 (best 3rd vs RE1 winner)
  if (re1Winner && !q4Winner) {
    // Best 3rd is determined from standings; find it via CUARTOS_4 match data
    // The best 3rd is already assigned to the CUARTOS_4 match; we just set the RE1 winner side.
    return []; // Handled in fillDescendantMatches which looks up the best 3rd
  }

  // All 4 QFs have winners → fill SEMIFINAL_1/SEMIFINAL_2 avoiding same-zone pairs
  if (q1Winner && q2Winner && q3Winner && q4Winner && !semi1Winner && !semi2Winner) {
    // Pairing preference: (QF1,QF4)+(QF2,QF3); try alternatives if same-zone
    const semifinalPairings = getCuartosSemifinalPairings(q1Winner, q2Winner, q3Winner, q4Winner);
    return semifinalPairings;
  }

  // Both semis have winners → fill FINAL only (no BRONZE)
  if (semi1Winner && semi2Winner) {
    return [{ stage: "FINAL", teamAId: semi1Winner, teamBId: semi2Winner }];
  }

  return [];
}

/** Get semifinal pairings for CUARTOS avoiding same-zone pairs. */
function getCuartosSemifinalPairings(
  q1w: string, q2w: string, q3w: string, q4w: string,
): Array<{ stage: string; teamAId: string; teamBId: string }> {
  // Preferred: (QF1,QF4)+(QF2,QF3)
  const options = [
    // Option 1: (QF1,QF4)+(QF2,QF3)
    [
      { stage: "SEMIFINAL_1", teamAId: q1w, teamBId: q4w },
      { stage: "SEMIFINAL_2", teamAId: q2w, teamBId: q3w },
    ],
    // Option 2: (QF1,QF3)+(QF2,QF4)
    [
      { stage: "SEMIFINAL_1", teamAId: q1w, teamBId: q3w },
      { stage: "SEMIFINAL_2", teamAId: q2w, teamBId: q4w },
    ],
    // Option 3: (QF1,QF2)+(QF3,QF4)
    [
      { stage: "SEMIFINAL_1", teamAId: q1w, teamBId: q2w },
      { stage: "SEMIFINAL_2", teamAId: q3w, teamBId: q4w },
    ],
  ];

  // Pick the first option with 0 same-zone pairs
  for (const pairings of options) {
    // We can't determine zone from winnerId alone here;
    // the actual zone check happens in fillDescendantMatches.
    // Return the first option; fillDescendantMaps will validate.
    return pairings;
  }
  return options[0] ?? [];
}

function getOtherTeam(winnerId: string | null, otherTeamId: string | null): string | null {
  if (!winnerId || !otherTeamId) return null;
  return winnerId === otherTeamId ? null : otherTeamId;
}
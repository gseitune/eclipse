import type { Zone } from "../generated/prisma/client";
import type { BestThirdStats, StandingRow } from "./standings";

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
 * Best second (3-zone format, addendum 2026-09-23, point diff added 2026-10-28):
 *  - unique best (won, then setDiff, then pointDiff) -> direct;
 *  - exactly two seconds tied on those -> DESEMPATE match between them for the
 *    qualifying spot (bracket waits for its result);
 *  - 3+ seconds tied on those -> blocked: detected and reported, and the
 *    organizer names the one that qualifies (resolveBestSecond). Points for is
 *    deliberately NOT used here: a desempate match is fairer than a metric
 *    nobody agreed on.
 */

export type StandingsByZone = Partial<Record<Zone, StandingRow[]>>;

/**
 * A zone position that survived the whole merit chain plus head-to-head cannot
 * seed the bracket. Returns one blocker per zone, or an empty list.
 */
function unresolvedZoneTies(
  standings: StandingsByZone,
  zones: Zone[],
  depth: number,
): string[] {
  const blockers: string[] = [];
  for (const zone of zones) {
    const rows = standings[zone];
    if (!rows) continue;
    if (rows.slice(0, depth).some((r) => r.unresolvedTie)) {
      blockers.push(`Zone ${zone}: tie unresolved`);
    }
  }
  return blockers;
}

export type BracketFormat = "STANDARD" | "REPECHAJE" | "CUARTOS";

/** How many rows of each zone the bracket actually seeds. */
const SEED_DEPTH: Record<BracketFormat, number> = {
  STANDARD: 2,
  REPECHAJE: 3,
  CUARTOS: 3,
};

/**
 * Rows that would block the bracket right now, for the state snapshot.
 *
 * Empty until the group phase is over: before that every zeroed row ties with
 * every other and nothing is being seeded. Empty too when the unresolved tie
 * sits below the places the format actually uses, because that tie never
 * reaches the bracket.
 */
export function unresolvedSeedRows(
  standings: StandingsByZone,
  format: BracketFormat,
  groupPhaseDone: boolean,
): StandingRow[] {
  if (!groupPhaseDone) return [];
  const depth = SEED_DEPTH[format];
  const rows: StandingRow[] = [];
  for (const zone of ["A", "B", "C"] as Zone[]) {
    const zoneRows = standings[zone];
    if (!zoneRows) continue;
    rows.push(...zoneRows.slice(0, depth).filter((r) => r.unresolvedTie));
  }
  return rows;
}

export interface BracketPairing {
  stage: string;
  teamAId: string;
  /**
   * Nullable because CUARTOS_1 (A1 vs the repechage winner) is published with
   * only its top-seed side known; fillDescendantMatches completes the other
   * side once REPECHAJE_1 is played.
   */
  teamBId: string | null;
}

export interface BuildBracketsOptions {
  /** Best-second already resolved (e.g. the DESEMPATE winner). */
  resolvedSecondId?: string;
  /**
   * Best third already resolved by the organizer. Andi's points rule (wins ->
   * point diff -> points for, restricted to each zone's top 2) can tie thirds
   * to the end of the chain, so the organizer picks the best third instead of
   * the engine inventing one.
   */
  resolvedThirdId?: string;
  /** Tournament bracket format. Defaults to STANDARD. */
  format?: BracketFormat;
}

export type BestSecondSelection =
  | { kind: "direct"; teamId: string }
  | { kind: "playoff"; teamAId: string; teamBId: string }
  | { kind: "blocked"; teamIds: string[] };

export type BestThirdSelection =
  | { kind: "direct"; teamId: string }
  | {
      kind: "blocked";
      /** Why the bracket waits: a real tie, or scores missing to compare. */
      reason: "best_third_tie" | "best_third_needs_scores";
      teamIds: string[];
    };

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
  const maxSetDiff = Math.max(...onWins.map((r) => r.setDiff));
  const onSetDiff = onWins.filter((r) => r.setDiff === maxSetDiff);
  const maxPointDiff = Math.max(...onSetDiff.map((r) => r.pointDiff));
  const top = onSetDiff.filter((r) => r.pointDiff === maxPointDiff);

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
      ...unresolvedZoneTies(standings, zones, 2),
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
      ...unresolvedZoneTies(standings, zones, 2),
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

  const missing: string[] = [...unresolvedZoneTies(standings, zones, 3)];
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
 *
 * Andi's rule (addendum 2026-10-10): each third is compared ONLY against its
 * own zone's top 2 (the match vs the 4th is dropped — this normalizes 4-team
 * vs 3-team zones). The restricted stats come precomputed from the standings
 * layer; criterion, in order: wins, point difference, points for.
 *  - A unique winner -> direct.
 *  - A total tie to the end of the chain -> blocked best_third_tie; the
 *    organizer resolves it (never invent a tiebreaker here).
 *  - Any vs-top-2 match without scores -> blocked best_third_needs_scores.
 */
export function selectBestThird(
  standings: StandingsByZone,
): BestThirdSelection | null {
  const zones = (Object.keys(standings) as Zone[]).filter(
    (z) => standings[z] !== undefined && standings[z]!.length >= 3,
  );
  if (zones.length < 3) return null;
  const thirds: StandingRow[] = zones.map((z) => standings[z]![2]);

  const statsOf = (r: StandingRow): BestThirdStats => r.bestThirdStats!;
  const missingScores = thirds.some(
    (r) => !r.bestThirdStats || r.bestThirdStats.needsScores,
  );
  if (missingScores) {
    return {
      kind: "blocked",
      reason: "best_third_needs_scores",
      teamIds: thirds.map((r) => r.teamId),
    };
  }

  const maxWon = Math.max(...thirds.map((r) => statsOf(r).won));
  const onWon = thirds.filter((r) => statsOf(r).won === maxWon);
  const maxDiff = Math.max(
    ...onWon.map((r) => statsOf(r).pointsFor - statsOf(r).pointsAgainst),
  );
  const onDiff = onWon.filter(
    (r) => statsOf(r).pointsFor - statsOf(r).pointsAgainst === maxDiff,
  );
  const maxFor = Math.max(...onDiff.map((r) => statsOf(r).pointsFor));
  const top = onDiff.filter((r) => statsOf(r).pointsFor === maxFor);

  if (top.length === 1) return { kind: "direct", teamId: top[0].teamId };
  return {
    kind: "blocked",
    reason: "best_third_tie",
    teamIds: top.map((r) => r.teamId),
  };
}

/** Build CUARTOS bracket pairings for a 3-zone tournament (11–12 teams). */
export function buildCuartosBrackets(
  standings: StandingsByZone,
  options: BuildBracketsOptions = {},
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

  const missing: string[] = [...unresolvedZoneTies(standings, zones, 3)];
  if (!a1 || !b1 || !c1) missing.push("Zone champion missing");
  if (!a2 || !b2 || !c2) missing.push("Zone runner-up missing");
  if (!a3 || !b3 || !c3) missing.push("Zone third missing");
  if (missing.length > 0) return { pairings: [], missing };

  const bestThird = selectBestThird(standings);
  if (!options.resolvedThirdId && bestThird?.kind === "blocked") {
    return {
      pairings: [],
      missing: [
        bestThird.reason === "best_third_tie"
          ? "Best third (tied)"
          : "Best third (needs scores)",
      ],
    };
  }

  const bestThirdId =
    options.resolvedThirdId ??
    (bestThird?.kind === "direct" ? bestThird.teamId : null);

  // Identify the two losing thirds (for REPECHAJE_1)
  const allThirds = [a3!, b3!, c3!].filter((r): r is StandingRow => r !== undefined);
  const losingThirds = allThirds.filter((r) => r.teamId !== bestThirdId);

  // Andi's seeding (1v8 / 2v7 / 3v6 / 4v5) over the qualifier order
  // [A1, B1, C1, A2, B2, C2, best 3rd, RE1 winner]:
  //   CUARTOS_1 = seed1 vs seed8 = A1 vs RE1 winner (teamB filled later)
  //   CUARTOS_2 = seed2 vs seed7 = B1 vs best 3rd
  //   CUARTOS_3 = seed4 vs seed5 = A2 vs B2
  //   CUARTOS_4 = seed3 vs seed6 = C1 vs C2
  return {
    pairings: [
      { stage: "REPECHAJE_1", teamAId: losingThirds[0]!.teamId, teamBId: losingThirds[1]!.teamId },
      { stage: "CUARTOS_1", teamAId: a1!.teamId, teamBId: null },
      { stage: "CUARTOS_2", teamAId: b1!.teamId, teamBId: bestThirdId! },
      { stage: "CUARTOS_3", teamAId: a2!.teamId, teamBId: b2!.teamId },
      { stage: "CUARTOS_4", teamAId: c1!.teamId, teamBId: c2!.teamId },
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
 * For CUARTOS format: RE1 → CUARTOS_1; 4 QFs → SEMIFINAL_1/2; both semis → FINAL only.
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

  // RE1 result → fill CUARTOS_1 (A1 vs RE1 winner). The A1 side is already set
  // at finalize; here only the RE1 winner side is missing, so this is completed
  // in fillDescendantMatches (which owns the CUARTOS_1 lookup).
  if (re1Winner && !q1Winner) {
    return [];
  }

  // All 4 QFs have winners → fill SEMIFINAL_1/SEMIFINAL_2 (fixed bracket:
  // QF1 vs QF4, QF2 vs QF3 — Andi's bracket, no same-zone avoidance).
  if (q1Winner && q2Winner && q3Winner && q4Winner && !semi1Winner && !semi2Winner) {
    return getCuartosSemifinalPairings(q1Winner, q2Winner, q3Winner, q4Winner);
  }

  // Both semis have winners → fill FINAL only (no BRONZE)
  if (semi1Winner && semi2Winner) {
    return [{ stage: "FINAL", teamAId: semi1Winner, teamBId: semi2Winner }];
  }

  return [];
}

/**
 * Fixed CUARTOS semifinal pairings (Andi's bracket): seed1v8 winner vs seed4v5
 * winner in SEMIFINAL_1, seed2v7 winner vs seed3v6 winner in SEMIFINAL_2.
 *
 * No same-zone avoidance: with the 1v8 seeding a B1-vs-B2 semi is not just
 * possible but expected (Andi's semifinal_2 was RG vs LM, both zone B).
 */
function getCuartosSemifinalPairings(
  q1w: string, q2w: string, q3w: string, q4w: string,
): Array<{ stage: string; teamAId: string; teamBId: string }> {
  return [
    { stage: "SEMIFINAL_1", teamAId: q1w, teamBId: q4w },
    { stage: "SEMIFINAL_2", teamAId: q2w, teamBId: q3w },
  ];
}

function getOtherTeam(winnerId: string | null, otherTeamId: string | null): string | null {
  if (!winnerId || !otherTeamId) return null;
  return winnerId === otherTeamId ? null : otherTeamId;
}
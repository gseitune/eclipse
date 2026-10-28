import type { ResultStatus, Zone } from "../generated/prisma/client";

/**
 * Zone standings (POSITIONS) for SELVARENA.
 *
 * Tiebreak criterion (product decision — Andi, 2026-10-28):
 *   1. More wins (PG).
 *   2. Set difference (sets for - sets against) counted ONLY from complete
 *      matches; WINNER_ONLY matches contribute no sets (never invent points).
 *   3. Point difference (points for - points against), also COMPLETE only.
 *   4. Points for (total points scored), also COMPLETE only.
 *   5. Deterministic draw: name ascending, then id ascending.
 *
 * Head-to-head was REMOVED on purpose: in a 3-team zone where everyone is 1-1
 * the direct results form a cycle and resolve nothing, which is exactly the
 * case Andi raised. The chain above matches her Intermedios spreadsheet
 * ("diferencia de sets → diferencia de puntos → puntos a favor").
 *
 * Zone ties always resolve into positions (no unresolvedTie anymore): the
 * only still-open tie case is the cross-zone best-second fight, handled at
 * the bracket level (DESEMPATE match / 3+ blocked edge).
 */

export interface StandingInputTeam {
  id: string;
  name: string;
  zone: Zone;
  maleName?: string | null;
  femaleName?: string | null;
}

export interface StandingInputMatch {
  stage: string;
  zone: Zone | null;
  teamAId: string | null;
  teamBId: string | null;
  setAScore: number | null;
  setBScore: number | null;
  /** Actual point scores (sum of the sets), only for COMPLETE matches. */
  pointsA?: number | null;
  pointsB?: number | null;
  resultStatus: ResultStatus;
  winnerId: string | null;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  zone: Zone;
  played: number;
  won: number;
  lost: number;
  setDiff: number;
  /** Points for minus points against. COMPLETE matches only. */
  pointDiff: number;
  /** Total points scored. COMPLETE matches only. */
  pointsFor: number;
  maleName: string | null;
  femaleName: string | null;
  /** Kept for API compatibility; zone ties now resolve deterministically. */
  unresolvedTie: boolean;
  /**
   * CUARTOS best-third comparison (addendum 2026-10-10): the stats of the
   * zone's 3rd place counted ONLY against its zone's top 2. This normalizes
   * 4-team vs 3-team zones. Computed after sorting, so only the third row of
   * a zone carries the value. Undefined for the other rows.
   */
  bestThirdStats?: BestThirdStats;
}

export interface BestThirdStats {
  /** Wins in the third's own matches vs the zone's top 2. */
  won: number;
  /** Points for in COMPLETE matches vs the zone's top 2. */
  pointsFor: number;
  /** Points against in COMPLETE matches vs the zone's top 2. */
  pointsAgainst: number;
  /** True when a vs-top-2 match has no scores: the points cannot be computed. */
  needsScores: boolean;
}

function isDecidedGroupMatch(
  m: StandingInputMatch,
  ids: ReadonlySet<string>,
): m is StandingInputMatch & { teamAId: string; teamBId: string } {
  return (
    m.stage === "GROUPS" &&
    m.resultStatus !== "PENDING" &&
    m.teamAId !== null &&
    m.teamBId !== null &&
    m.teamAId !== m.teamBId &&
    ids.has(m.teamAId) &&
    ids.has(m.teamBId)
  );
}

/**
 * Restricted stats of a zone's 3rd place against its zone's top 2 (CUARTOS
 * best-third rule). Counts only decided zone matches against the two teams
 * that finished above the third; wins come from winnerId, points only from
 * COMPLETE matches, and a scoreless vs-top-2 match marks needsScores so the
 * bracket blocks instead of inventing a metric.
 */
function bestThirdRestrictedStats(
  thirdId: string,
  topTwoIds: ReadonlySet<string>,
  matches: StandingInputMatch[],
  zoneIds: ReadonlySet<string>,
): BestThirdStats {
  const stats: BestThirdStats = {
    won: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    needsScores: false,
  };
  for (const m of matches) {
    if (!isDecidedGroupMatch(m, zoneIds)) continue;
    const opponent =
      m.teamAId === thirdId ? m.teamBId : m.teamBId === thirdId ? m.teamAId : null;
    if (!opponent || !topTwoIds.has(opponent)) continue;
    if (m.winnerId === thirdId) stats.won += 1;
    if (m.resultStatus !== "COMPLETE" || m.pointsA == null || m.pointsB == null) {
      stats.needsScores = true;
      continue;
    }
    if (m.teamAId === thirdId) {
      stats.pointsFor += m.pointsA;
      stats.pointsAgainst += m.pointsB;
    } else {
      stats.pointsFor += m.pointsB;
      stats.pointsAgainst += m.pointsA;
    }
  }
  return stats;
}

/**
 * Computes the standings of one zone from group-phase matches only.
 * Match counts include WINNER_ONLY and COMPLETE results; sets and points
 * count only for COMPLETE results.
 */
export function computeZoneStandings(
  teams: StandingInputTeam[],
  matches: StandingInputMatch[],
  zone: Zone,
): StandingRow[] {
  const zoneTeams = teams.filter((t) => t.zone === zone);
  const zoneIds = new Set(zoneTeams.map((t) => t.id));

  const rows = new Map<string, StandingRow>();
  for (const t of zoneTeams) {
    rows.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      zone,
      played: 0,
      won: 0,
      lost: 0,
      setDiff: 0,
      pointDiff: 0,
      pointsFor: 0,
      maleName: t.maleName ?? null,
      femaleName: t.femaleName ?? null,
      unresolvedTie: false,
    });
  }

  for (const m of matches) {
    if (!isDecidedGroupMatch(m, zoneIds)) continue;
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    if (m.winnerId === m.teamAId) a.won += 1;
    else if (m.winnerId === m.teamBId) b.won += 1;
    if (
      m.resultStatus === "COMPLETE" &&
      m.setAScore !== null &&
      m.setBScore !== null
    ) {
      a.setDiff += m.setAScore - m.setBScore;
      b.setDiff += m.setBScore - m.setAScore;
    }
    if (
      m.resultStatus === "COMPLETE" &&
      m.pointsA != null &&
      m.pointsB != null
    ) {
      a.pointDiff += m.pointsA - m.pointsB;
      b.pointDiff += m.pointsB - m.pointsA;
      a.pointsFor += m.pointsA;
      b.pointsFor += m.pointsB;
    }
  }

  for (const row of rows.values()) row.lost = row.played - row.won;

  // Wins first, then the Andi chain: set diff → point diff → points for,
  // and the deterministic draw by name and id as the last resort.
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.won - a.won ||
      b.setDiff - a.setDiff ||
      b.pointDiff - a.pointDiff ||
      b.pointsFor - a.pointsFor ||
      a.teamName.localeCompare(b.teamName) ||
      a.teamId.localeCompare(b.teamId),
  );

  // CUARTOS best third: the 3rd place is only ever compared against its own
  // zone's top 2, and only post-sort positions define who those are.
  if (sorted.length >= 3) {
    const third = sorted[2];
    const topTwo = new Set([sorted[0].teamId, sorted[1].teamId]);
    third.bestThirdStats = bestThirdRestrictedStats(
      third.teamId,
      topTwo,
      matches,
      zoneIds,
    );
  }

  return sorted;
}
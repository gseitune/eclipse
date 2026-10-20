import type { ResultStatus, Zone } from "../generated/prisma/client";

/**
 * Zone standings (POSITIONS) for SELVARENA.
 *
 * Tiebreak criterion (product decision — addendum 2026-09-23):
 *   1. More wins (PG).
 *   2. Head-to-head among the tied teams: the winner of the direct match
 *      ranks above (winnerId from ANY decided match — WINNER_ONLY is enough,
 *      no score needed).
 *   3. Set difference (sets for - sets against) counted ONLY from complete
 *      matches; WINNER_ONLY matches contribute no sets (never invent points).
 *   4. Deterministic draw: name ascending, then id ascending. Documented
 *      fallback for the guard "they never faced each other" (should not
 *      happen in round-robin). The backend never fabricates a metric.
 *
 * Zone ties always resolve into positions (no unresolvedTie anymore): the
 * only still-open tie case is the cross-zone best-second fight, handled at
 * the bracket level (DESEMPATE match / 3+ blocked edge).
 *
 * PENDING (Andi): her Intermedios spreadsheet orders the zone by
 * "diferencia de sets → diferencia de puntos → puntos a favor", while the
 * order implemented here starts with wins and head-to-head. The sample she
 * shared cannot tell them apart, so this stays as documented until she
 * confirms which one rules.
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

/** Wins in direct matches against the other members of the same won-clique. */
function headToHeadWins(
  slice: StandingRow[],
  matches: StandingInputMatch[],
): Map<string, number> {
  const ids = new Set(slice.map((r) => r.teamId));
  const wins = new Map<string, number>();
  for (const m of matches) {
    if (!isDecidedGroupMatch(m, ids)) continue;
    if (m.winnerId) wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
  }
  return wins;
}

/**
 * Reorders an equal-wins clique [start..end] of `rows` with the full
 * tiebreak chain: head-to-head first, then setDiff, then deterministic draw.
 * `rows` must already be sorted by (won, name, id) so equal-wins teams are
 * contiguous.
 */
function resolveClique(
  rows: StandingRow[],
  matches: StandingInputMatch[],
  start: number,
  end: number,
): void {
  const slice = rows.slice(start, end + 1);
  const h2h = headToHeadWins(slice, matches);
  slice.sort(
    (x, y) =>
      (h2h.get(y.teamId) ?? 0) - (h2h.get(x.teamId) ?? 0) ||
      y.setDiff - x.setDiff ||
      x.teamName.localeCompare(y.teamName) ||
      x.teamId.localeCompare(y.teamId),
  );
  rows.splice(start, end - start + 1, ...slice);
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
 * Match counts include WINNER_ONLY and COMPLETE results; sets count only
 * for COMPLETE results; head-to-head uses winnerId from any decided match.
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
  }

  for (const row of rows.values()) row.lost = row.played - row.won;

  // Base order: wins only (h2h precedes setDiff, so equal-wins teams must
  // stay contiguous before the clique resolver applies the full chain).
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.won - a.won ||
      a.teamName.localeCompare(b.teamName) ||
      a.teamId.localeCompare(b.teamId),
  );

  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].won === sorted[i].won) {
      j += 1;
    }
    if (j > i) resolveClique(sorted, matches, i, j);
    i = j + 1;
  }

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
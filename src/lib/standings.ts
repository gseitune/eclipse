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
 */

export interface StandingInputTeam {
  id: string;
  name: string;
  zone: Zone;
}

export interface StandingInputMatch {
  stage: string;
  zone: Zone | null;
  teamAId: string | null;
  teamBId: string | null;
  setAScore: number | null;
  setBScore: number | null;
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
  /** Kept for API compatibility; zone ties now resolve deterministically. */
  unresolvedTie: boolean;
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

  return sorted;
}
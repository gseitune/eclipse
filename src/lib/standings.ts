import type { ResultStatus, Zone } from "../generated/prisma/client";

/**
 * Zone standings (POSITIONS) for SELVARENA.
 *
 * Tiebreak criterion (product decision, reported to the organizer):
 *   1. More wins (PG).
 *   2. Set difference (sets for - sets against) counted ONLY from complete
 *      matches; WINNER_ONLY matches contribute no sets (never invent points).
 *   3. Head-to-head among the tied teams.
 *   4. Unresolved tie -> organizer draw; never fabricate a metric.
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
  /** true when the tiebreak criteria could not fully separate this team from its clique. */
  unresolvedTie: boolean;
}

function compareRows(a: StandingRow, b: StandingRow): number {
  return (
    b.won - a.won ||
    b.setDiff - a.setDiff ||
    a.teamName.localeCompare(b.teamName)
  );
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
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
 * Reorders a tied clique [start..end] of `rows` by head-to-head and flags
 * unresolved ties. `rows` must already be sorted by (won, setDiff, name).
 */
function resolveHeadToHead(
  rows: StandingRow[],
  matches: StandingInputMatch[],
  start: number,
  end: number,
): void {
  const slice = rows.slice(start, end + 1);
  const ids = new Set(slice.map((r) => r.teamId));
  const direct = matches.filter((m) => isDecidedGroupMatch(m, ids));

  const knownPairs = new Set<string>();
  const h2hWins = new Map<string, number>();
  for (const m of direct) {
    knownPairs.add(pairKey(m.teamAId, m.teamBId));
    if (m.winnerId) {
      h2hWins.set(m.winnerId, (h2hWins.get(m.winnerId) ?? 0) + 1);
    }
  }

  const expectedPairs = (slice.length * (slice.length - 1)) / 2;
  const missingPair = knownPairs.size !== expectedPairs;

  slice.sort(
    (x, y) =>
      (h2hWins.get(y.teamId) ?? 0) - (h2hWins.get(x.teamId) ?? 0) ||
      x.teamName.localeCompare(y.teamName),
  );

  // Flag unresolved: identical h2h wins OR a pair without a direct result.
  const byWins = new Map<number, StandingRow[]>();
  for (const row of slice) {
    const w = h2hWins.get(row.teamId) ?? 0;
    byWins.set(w, [...(byWins.get(w) ?? []), row]);
  }
  const tiedOnH2h = [...byWins.values()].some((group) => group.length > 1);

  if (missingPair || tiedOnH2h) {
    for (const row of slice) row.unresolvedTie = true;
  }

  rows.splice(start, end - start + 1, ...slice);
}

/**
 * Computes the standings of one zone from group-phase matches only.
 * Match counts include WINNER_ONLY and COMPLETE results; sets count only
 * for COMPLETE results.
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

  const sorted = [...rows.values()].sort(compareRows);

  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (
      j + 1 < sorted.length &&
      sameRankKey(sorted[j], sorted[j + 1])
    ) {
      j += 1;
    }
    if (j > i) resolveHeadToHead(sorted, matches, i, j);
    i = j + 1;
  }

  return sorted;
}

function sameRankKey(a: StandingRow, b: StandingRow): boolean {
  return a.won === b.won && a.setDiff === b.setDiff;
}
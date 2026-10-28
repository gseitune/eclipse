import type { ResultStatus, Zone } from "../generated/prisma/client";

/**
 * Zone standings (POSITIONS) for SELVARENA.
 *
 * Tiebreak criterion (product decisions — Andi 2026-10-28, refined same day):
 *   1. More wins (PG).
 *   2. Set difference (sets for - sets against) counted ONLY from complete
 *      matches; WINNER_ONLY matches contribute no sets (never invent points).
 *   3. Point difference (points for - points against), also COMPLETE only.
 *   4. Points for (total points scored), also COMPLETE only.
 *   5. Head-to-head: only as the LAST resort and only inside the zone, i.e.
 *      between teams that already tie on 1-4 and actually faced each other.
 *
 * Name and id are NEVER a tiebreak. A group that survives the whole chain
 * (3+ teams with a circular head-to-head) stays unresolvedTie; the bracket
 * refuses to seed it instead of inventing an order.
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
  /**
   * True when this row belongs to a tie that survived the whole merit chain
   * plus head-to-head (3+ teams with a circular head-to-head). The bracket
   * refuses to seed a zone while a needed slot is unresolved.
   */
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
 * Merit chain used for every zone position: more wins, then set difference,
 * then point difference, then points for. Never name, never id.
 */
function compareMerit(a: StandingRow, b: StandingRow): number {
  return (
    b.won - a.won ||
    b.setDiff - a.setDiff ||
    b.pointDiff - a.pointDiff ||
    b.pointsFor - a.pointsFor
  );
}

function sameMerit(a: StandingRow, b: StandingRow): boolean {
  return compareMerit(a, b) === 0;
}

/**
 * Last-resort tiebreak INSIDE a zone: head-to-head wins among the teams still
 * tied on the whole merit chain. Only makes sense inside a zone, because those
 * teams faced each other.
 *
 * A group that survives this (3+ teams with a circular head-to-head — every
 * match 21-19/19-21 is enough) is left UNRESOLVED on purpose. The zone is never
 * ordered by name or id; whoever needs those positions gets a blocked bracket
 * instead of an invented order.
 */
function resolveHeadToHead(
  rows: StandingRow[],
  matches: StandingInputMatch[],
  start: number,
  end: number,
): void {
  const slice = rows.slice(start, end + 1);
  const ids = new Set(slice.map((r) => r.teamId));
  const wins = new Map<string, number>();
  for (const m of matches) {
    if (!isDecidedGroupMatch(m, ids)) continue;
    if (m.winnerId) wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
  }
  const h2h = (r: StandingRow): number => wins.get(r.teamId) ?? 0;
  slice.sort((x, y) => h2h(y) - h2h(x));

  let i = 0;
  while (i < slice.length) {
    let j = i + 1;
    while (j < slice.length && h2h(slice[j]) === h2h(slice[i])) j += 1;
    if (j - i > 1) {
      for (let k = i; k < j; k += 1) slice[k].unresolvedTie = true;
    }
    i = j;
  }

  rows.splice(start, end - start + 1, ...slice);
}

/**
 * Applies the organizer's manual order to the rows that are still unresolved
 * in this zone. Ignored unless the order lists exactly those teams once each:
 * a stale order (results changed) must never reorder anything.
 */
function applyManualOrder(rows: StandingRow[], order: readonly string[]): void {
  const tied = rows.filter((r) => r.unresolvedTie);
  if (tied.length < 2) return;
  const tiedIds = new Set(tied.map((r) => r.teamId));
  if (order.length !== tiedIds.size) return;
  if (new Set(order).size !== order.length) return;
  if (!order.every((id) => tiedIds.has(id))) return;

  const rank = new Map(order.map((id, index) => [id, index]));
  const ordered = [...tied].sort(
    (a, b) => (rank.get(a.teamId) ?? 0) - (rank.get(b.teamId) ?? 0),
  );
  let cursor = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (!rows[i].unresolvedTie) continue;
    rows[i] = { ...ordered[cursor], unresolvedTie: false };
    cursor += 1;
  }
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
  /**
   * Organizer's manual order for an otherwise unresolved tie in this zone
   * (team ids, best position first). Ignored when it does not match the teams
   * that are actually still tied.
   */
  manualOrder?: readonly string[],
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

  // Merit chain: wins → set diff → point diff → points for. A group that is
  // still tied goes to head-to-head (inside the zone only). Whatever survives
  // that stays unresolved: no position is ever decided by name or id.
  const sorted = [...rows.values()].sort(compareMerit);
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameMerit(sorted[i], sorted[j])) j += 1;
    if (j - i > 1) resolveHeadToHead(sorted, matches, i, j - 1);
    i = j;
  }

  if (manualOrder && manualOrder.length > 0) applyManualOrder(sorted, manualOrder);

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
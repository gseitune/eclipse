/**
 * Tournament group rules (Gabriel's spec).
 *
 * - Minimum 6 teams to run a tournament.
 * - 6–10 teams  -> 2 zones.
 * - >10 teams   -> 3 zones.
 * - Sizes are BALANCED (max difference 1): 11 teams / 3 zones -> 4/4/3,
 *   13 -> 5/4/4. When the split is uneven, randomly chosen zone(s) carry
 *   the extra team(s).
 */

export const MIN_TEAMS = 6;
export const MAX_TEAMS_TWO_GROUPS = 10;

export type GroupId = "A" | "B" | "C";

export interface TeamGroup {
  group: GroupId;
  teams: string[];
}

export function groupCountFor(teamCount: number): 2 | 3 {
  if (!Number.isInteger(teamCount) || teamCount < MIN_TEAMS) {
    throw new Error(
      `Tournament requires at least ${MIN_TEAMS} teams, got ${teamCount}.`,
    );
  }
  return teamCount <= MAX_TEAMS_TWO_GROUPS ? 2 : 3;
}

/**
 * Splits team names into zones. Teams keep their input order (a later
 * registration "draw" step may shuffle). Sizes differ by at most one team;
 * which zone(s) get the extra is random. Inject `rng` for tests.
 */
export function distributeTeams(
  teamNames: readonly string[],
  rng: () => number = Math.random,
): TeamGroup[] {
  const count = teamNames.length;
  const groupCount = groupCountFor(count);
  const groupIds: GroupId[] =
    groupCount === 2 ? ["A", "B"] : ["A", "B", "C"];

  const baseSize = Math.floor(count / groupCount);
  const remainder = count % groupCount;

  // Balanced sizes; randomly pick which groups carry the extras.
  const indices = groupIds.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const extraGroups = new Set(indices.slice(0, remainder));

  const groups: TeamGroup[] = groupIds.map((group) => ({
    group,
    teams: [],
  }));

  let cursor = 0;
  for (const [index, group] of groups.entries()) {
    const size = baseSize + (extraGroups.has(index) ? 1 : 0);
    group.teams = teamNames.slice(cursor, cursor + size);
    cursor += size;
  }

  return groups;
}

/**
 * Round-robin pairings for one group (circle method): every team plays every
 * other team exactly once. Deterministic; returns n*(n-1)/2 pairs ordered in
 * the canonical "fixed wheel" sequence. Used to generate the group fixture of
 * a newly created etapa (single court, slots assigned later).
 */
export function roundRobinPairs(
  teamIds: readonly string[],
): Array<[string, string]> {
  const n = teamIds.length;
  if (n < 2) return [];
  // Odd counts add a "bye" so the circle has an even number of seats: with
  // n teams the rounds are n (odd) or n-1 (even), each team playing once
  // per round except the bye. Total pairs stay n*(n-1)/2.
  const arr = n % 2 === 1 ? [...teamIds, null] : [...teamIds];
  const full = arr.length;
  const [fixed, ...rest] = arr;
  const pairs: Array<[string, string]> = [];
  let rot = [...rest];
  for (let round = 0; round < full - 1; round++) {
    const lineup = [fixed, ...rot];
    for (let i = 0; i < Math.floor(full / 2); i++) {
      const a = lineup[i];
      const b = lineup[full - 1 - i];
      if (a === null || b === null) continue;
      if (a !== b) pairs.push([a, b]);
    }
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
  }
  return pairs;
}
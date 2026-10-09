import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { distributeTeams, groupCountFor, interleaveGroupPairs, MIN_TEAMS, roundRobinPairs } from "./tournament";

const alwaysZero = () => 0;

function sizes(groups: { teams: string[] }[]): number[] {
  return groups.map((g) => g.teams.length);
}

function allTeams(groups: { teams: string[] }[]): string[] {
  return groups.flatMap((g) => g.teams);
}

function names(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Team ${i + 1}`);
}

describe("groupCountFor", () => {
  it("throws below the minimum team count", () => {
    for (const count of [0, 5, -1, 2.5]) {
      assert.throws(
        () => groupCountFor(count),
        new RegExp(`at least ${MIN_TEAMS} teams`),
      );
    }
  });

  it("returns 2 zones for 6–10 teams", () => {
    for (let count = 6; count <= 10; count++) {
      assert.equal(groupCountFor(count), 2);
    }
  });

  it("returns 3 zones for more than 10 teams", () => {
    for (let count = 11; count <= 20; count++) {
      assert.equal(groupCountFor(count), 3);
    }
  });
});

describe("distributeTeams", () => {
  it("throws below the minimum team count", () => {
    assert.throws(() => distributeTeams(names(5)), /at least 6 teams/);
  });

  it("splits 6 teams into two balanced zones of 3", () => {
    const groups = distributeTeams(names(6), alwaysZero);
    assert.deepEqual(sizes(groups), [3, 3]);
    assert.deepEqual(
      groups.map((g) => g.group),
      ["A", "B"],
    );
  });

  it("splits 10 teams into two balanced zones of 5", () => {
    const groups = distributeTeams(names(10), alwaysZero);
    assert.deepEqual(sizes(groups), [5, 5]);
  });

  it("splits 11 teams into three zones of 3/4/4 (max difference 1)", () => {
    const groups = distributeTeams(names(11), alwaysZero);
    assert.deepEqual(sizes(groups), [3, 4, 4]);
    assert.deepEqual(
      groups.map((g) => g.group),
      ["A", "B", "C"],
    );
  });

  it("splits 12 teams into three zones of 4", () => {
    const groups = distributeTeams(names(12), alwaysZero);
    assert.deepEqual(sizes(groups), [4, 4, 4]);
  });

  it("splits 13 teams into three zones of 4/5/4", () => {
    const groups = distributeTeams(names(13), alwaysZero);
    assert.deepEqual(sizes(groups), [4, 5, 4]);
  });

  it("keeps input order and never drops or duplicates teams", () => {
    const input = names(13);
    const groups = distributeTeams(input, alwaysZero);
    assert.deepEqual(allTeams(groups), input);
  });

  it("keeps sizes balanced (max difference 1) for any remainder with random RNG", () => {
    for (let count = 6; count <= 20; count++) {
      for (let run = 0; run < 50; run++) {
        const groups = distributeTeams(names(count));
        const dims = sizes(groups);
        assert.ok(
          Math.max(...dims) - Math.min(...dims) <= 1,
          `unbalanced sizes ${dims.join("/")} for ${count} teams`,
        );
        assert.equal(allTeams(groups).length, count);
      }
    }
  });

  it("uses the injected RNG to choose which zones carry extras", () => {
    // rng = 0 drives the Fisher-Yates shuffle deterministically: for 11 teams
    // the two extras land on zones B and C (sizes 3/4/4), for 13 teams the
    // single extra lands on zone B (sizes 4/5/4). A different rng placement
    // proves the zones are chosen by the RNG, not fixed by position.
    const eleven = distributeTeams(names(11), alwaysZero);
    assert.deepEqual(sizes(eleven), [3, 4, 4]);

    const thirteen = distributeTeams(names(13), alwaysZero);
    assert.deepEqual(sizes(thirteen), [4, 5, 4]);

    const otherRng = distributeTeams(names(11), () => 0.99);
    assert.notDeepEqual(sizes(otherRng), sizes(eleven));
    assert.deepEqual(
      allTeams(otherRng),
      allTeams(eleven),
      "team membership must not depend on the RNG",
    );
  });
});

describe("roundRobinPairs", () => {
  it("returns no pairs for fewer than two teams", () => {
    assert.deepEqual(roundRobinPairs([]), []);
    assert.deepEqual(roundRobinPairs(["a"]), []);
  });

  it("generates every unordered pair exactly once for a 5-team group", () => {
    const ids = ["t1", "t2", "t3", "t4", "t5"];
    const pairs = roundRobinPairs(ids);
    assert.equal(pairs.length, 10, "5 teams play 4 rounds x 2 courts = 10 matches");
    const seen = new Set<string>();
    for (const [a, b] of pairs) {
      const key = [a, b].sort().join("|");
      assert.ok(!seen.has(key), `duplicate pair ${a}-${b}`);
      seen.add(key);
      assert.notEqual(a, b, "nobody plays themselves");
    }
    assert.equal(seen.size, 10);
  });

  it("gives every team exactly 4 opponents in a 5-team group", () => {
    const ids = ["t1", "t2", "t3", "t4", "t5"];
    const opponents = new Map<string, string[]>(ids.map((id) => [id, []]));
    for (const [a, b] of roundRobinPairs(ids)) {
      opponents.get(a)?.push(b);
      opponents.get(b)?.push(a);
    }
    for (const id of ids) {
      assert.equal(opponents.get(id)?.length, 4, `${id} plays everyone else once`);
    }
  });

  it("handles an even 6-team group with the same properties", () => {
    const ids = names(6);
    const pairs = roundRobinPairs(ids);
    assert.equal(pairs.length, 15, "6 teams play 15 matches");
    const oppCount = new Map(ids.map((id) => [id, 0]));
    for (const [a, b] of pairs) {
      oppCount.set(a, (oppCount.get(a) ?? 0) + 1);
      oppCount.set(b, (oppCount.get(b) ?? 0) + 1);
    }
    for (const [id, count] of oppCount) {
      assert.equal(count, 5, `${id} plays 5 matches`);
    }
  });

  it("is deterministic", () => {
    const a = roundRobinPairs(names(6));
    const b = roundRobinPairs(names(6));
    assert.deepEqual(a, b);
  });
});

describe("interleaveGroupPairs", () => {
  const zone = (group: "A" | "B" | "C", n: number) => ({
    group,
    teamIds: Array.from({ length: n }, (_, i) => `${group}${i + 1}`),
  });

  it("rotates one match per zone and skips exhausted zones (4/4/3 fixture)", () => {
    const placed = interleaveGroupPairs([zone("A", 4), zone("B", 4), zone("C", 3)]);
    assert.equal(placed.length, 15, "4/4/3 zones play 6+6+3 matches");
    assert.equal(
      placed.map((p) => p.group).join(""),
      "ABCABCABCABABAB",
      "one match per zone per turn; C drops out once exhausted",
    );
  });

  it("alternates two zones (A,B,A,B…)", () => {
    const placed = interleaveGroupPairs([zone("A", 4), zone("B", 4)]);
    assert.equal(placed.map((p) => p.group).join(""), "ABABABABABAB");
  });

  it("keeps each zone's internal round-robin order", () => {
    const placed = interleaveGroupPairs([zone("A", 4), zone("B", 4)]);
    const zoneA = placed
      .filter((p) => p.group === "A")
      .map((p) => [p.teamAId, p.teamBId] as [string, string]);
    assert.deepEqual(zoneA, roundRobinPairs(zone("A", 4).teamIds));
  });

  it("places every unordered pair exactly once across all zones", () => {
    const placed = interleaveGroupPairs([zone("A", 4), zone("B", 4), zone("C", 3)]);
    const seen = new Set<string>();
    for (const p of placed) {
      assert.notEqual(p.teamAId, p.teamBId, "nobody plays themselves");
      const key = `${p.group}:${[p.teamAId, p.teamBId].sort().join("|")}`;
      assert.ok(!seen.has(key), `duplicate pair ${key}`);
      seen.add(key);
    }
    assert.equal(seen.size, 15);
  });

  it("never makes a team play two matches back-to-back", () => {
    const placed = interleaveGroupPairs([zone("A", 4), zone("B", 4), zone("C", 3)]);
    for (let i = 1; i < placed.length; i++) {
      const prev = new Set([placed[i - 1].teamAId, placed[i - 1].teamBId]);
      for (const team of [placed[i].teamAId, placed[i].teamBId]) {
        assert.ok(!prev.has(team), `team ${team} plays back-to-back at position ${i}`);
      }
    }
  });

  it("is deterministic", () => {
    const a = interleaveGroupPairs([zone("A", 4), zone("B", 4), zone("C", 3)]);
    const b = interleaveGroupPairs([zone("A", 4), zone("B", 4), zone("C", 3)]);
    assert.deepEqual(a, b);
  });
});

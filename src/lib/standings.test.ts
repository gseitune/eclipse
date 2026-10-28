import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Zone } from "../generated/prisma/client";
import {
  computeZoneStandings,
  type StandingInputMatch,
  type StandingInputTeam,
} from "./standings";

const A: Zone = "A";
const B: Zone = "B";

function team(id: string, zone: Zone): StandingInputTeam {
  return { id, name: id.toUpperCase(), zone };
}

function groupMatch(p: {
  a: string;
  b: string;
  zone: Zone;
  status: "PENDING" | "WINNER_ONLY" | "COMPLETE";
  winner?: string | null;
  sets?: [number, number];
  points?: [number, number];
}): StandingInputMatch {
  return {
    stage: "GROUPS",
    zone: p.zone,
    teamAId: p.a,
    teamBId: p.b,
    setAScore: p.sets?.[0] ?? null,
    setBScore: p.sets?.[1] ?? null,
    pointsA: p.points?.[0] ?? null,
    pointsB: p.points?.[1] ?? null,
    resultStatus: p.status,
    winnerId: p.status === "PENDING" ? null : (p.winner ?? null),
  };
}

describe("computeZoneStandings", () => {
  it("ranks by wins first", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // t2 wins both matches; t1 and t3 not tied with it.
    const matches = [
      groupMatch({ a: "t1", b: "t3", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 1] }),
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t2", sets: [0, 2] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.deepEqual(
      rows.map((r) => r.teamId),
      ["t2", "t1", "t3"],
    );
    assert.equal(rows[0].won, 2);
    assert.equal(rows[2].played, 2);
  });

  it("set diff decides the tie; head-to-head no longer applies", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A), team("t4", A)];
    // t1 and t2 are both 2-1: t1 beat t2 head-to-head (2-1) but t2 has the
    // better overall set diff (+3 vs +1). Set diff must rank t2 above.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 1] }),
      groupMatch({ a: "t1", b: "t3", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 1] }),
      groupMatch({ a: "t1", b: "t4", zone: A, status: "COMPLETE", winner: "t4", sets: [1, 2] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0] }),
      groupMatch({ a: "t2", b: "t4", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0] }),
      groupMatch({ a: "t3", b: "t4", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    const t1 = rows.find((r) => r.teamId === "t1")!;
    const t2 = rows.find((r) => r.teamId === "t2")!;
    assert.ok(t1.setDiff < t2.setDiff, "t2 really has the better set diff");
    assert.ok(
      rows.indexOf(t2) < rows.indexOf(t1),
      "set diff ranks above the head-to-head winner",
    );
    assert.deepEqual(rows.map((r) => r.teamId), ["t2", "t1", "t3", "t4"]);
  });

  it("resolves a 3-team 1-1 cycle by point diff (Andi's case)", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // Every team wins one and loses one, and every match is 2-0, so all
    // three have set diff 0 and the head-to-head is a cycle: only the point
    // diff can separate them.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0], points: [42, 20] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0], points: [42, 38] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.ok(
      rows.every((r) => r.won === 1 && r.setDiff === 0),
      "wins and set diff are identical, so only point diff separates them",
    );
    assert.deepEqual(rows.map((r) => r.teamId), ["t1", "t3", "t2"]);
    assert.equal(rows[0].pointDiff, 18, "+22 then -4");
    assert.equal(rows[2].pointDiff, -18);
  });

  it("points for decides when set diff and point diff are equal", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // All three end 1-1, set diff 0 and point diff 0. t1 has the fewest
    // points scored, so it drops despite being first by name.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [44, 40] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.ok(
      rows.every((r) => r.setDiff === 0 && r.pointDiff === 0),
      "set diff and point diff are identical",
    );
    assert.deepEqual(rows.map((r) => r.teamId), ["t2", "t3", "t1"]);
    assert.equal(rows[2].pointsFor, 80, "t1 scored the fewest points");
    assert.equal(rows[0].pointsFor, 82);
  });

  it("never counts points from WINNER_ONLY matches", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // t1 beat t2 by winner only: no scoreboard, so it adds no set diff and
    // no point diff, and t1 still drops on the metrics it does not have.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "WINNER_ONLY", winner: "t1" }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0], points: [42, 38] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    const t1 = rows.find((r) => r.teamId === "t1")!;
    assert.equal(t1.won, 1, "the winner-only match counts as a win");
    assert.equal(t1.setDiff, -2, "no sets invented");
    assert.equal(t1.pointDiff, -4, "no points invented");
    assert.deepEqual(rows.map((r) => r.teamId), ["t2", "t3", "t1"]);
  });

  it("never counts sets from WINNER_ONLY matches", () => {
    const teams = [team("t1", A), team("t2", A)];
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "WINNER_ONLY", winner: "t1" }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.equal(rows[0].teamId, "t1");
    assert.equal(rows[0].won, 1);
    assert.equal(rows[0].setDiff, 0, "no sets may be invented");
  });

  it("counts multi-set matches by sets won (2-1 gives set diff +1)", () => {
    const teams = [team("t1", A), team("t2", A)];
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 1] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.equal(rows[0].teamId, "t1");
    assert.equal(rows[0].won, 1);
    assert.equal(rows[0].played, 1);
    assert.equal(rows[0].setDiff, 1, "2 sets won - 1 set lost");
    assert.equal(rows[1].setDiff, -1);
  });

  it("ignores PENDING matches, other zones and eliminatories", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", B)];
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "PENDING" }),
      groupMatch({ a: "t1", b: "t2", zone: A, status: "WINNER_ONLY", winner: "t1" }),
      groupMatch({ a: "t1", b: "t3", zone: B, status: "WINNER_ONLY", winner: "t3" }),
      {
        stage: "SEMIFINAL_1",
        zone: A,
        teamAId: "t1",
        teamBId: "t2",
        setAScore: 2,
        setBScore: 0,
        resultStatus: "COMPLETE" as const,
        winnerId: "t1",
      } satisfies StandingInputMatch,
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.equal(rows[0].played, 1, "only own-zone group matches count");
    assert.equal(rows[0].setDiff, 0, "semifinal sets do not count");
  });

  it("computes every zone independently", () => {
    const teams = [
      team("a1", A),
      team("a2", A),
      team("b1", B),
      team("b2", B),
    ];
    const matches = [
      groupMatch({ a: "a1", b: "a2", zone: A, status: "COMPLETE", winner: "a1", sets: [2, 0] }),
      groupMatch({ a: "b1", b: "b2", zone: B, status: "COMPLETE", winner: "b2", sets: [1, 2] }),
    ];
    const zoneA = computeZoneStandings(teams, matches, A);
    const zoneB = computeZoneStandings(teams, matches, B);
    assert.equal(zoneA[0].teamId, "a1");
    assert.equal(zoneB[0].teamId, "b2");
    assert.equal(zoneA[0].zone, A);
    assert.equal(zoneB[0].zone, B);
  });

  it("head-to-head decides as the LAST resort, after every metric", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A), team("t4", A)];
    // t1 and t2 end identical on wins, set diff, point diff and points for
    // (2-1, +2 sets, +4 points, 122 scored). They played, t1 won, so t1 goes
    // above. t3 and t4 are clearly worse.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t1", b: "t4", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t2", b: "t4", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t4", b: "t3", zone: A, status: "COMPLETE", winner: "t4", sets: [2, 0], points: [42, 38] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    const t1 = rows.find((r) => r.teamId === "t1")!;
    const t2 = rows.find((r) => r.teamId === "t2")!;
    assert.deepEqual(
      [t1.won, t1.setDiff, t1.pointDiff, t1.pointsFor],
      [t2.won, t2.setDiff, t2.pointDiff, t2.pointsFor],
      "every merit metric is identical",
    );
    assert.deepEqual(rows.map((r) => r.teamId), ["t1", "t2", "t4", "t3"]);
    assert.ok(rows.every((r) => !r.unresolvedTie), "head-to-head resolved it");
  });

  it("leaves a circular 3-way tie unresolved instead of using names", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // Every match is 21-19/19-21: all three end 1-1 with set diff 0, point
    // diff 0 and 80 points for, and the head-to-head is a circle. No merit
    // metric is left, and the alphabet is not an option.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [42, 38] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0], points: [42, 38] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.ok(
      rows.every((r) => r.unresolvedTie),
      "the tie is reported, not decided by name",
    );
  });
});
describe("manual zone-tie order", () => {
  const teams = [team("t1", A), team("t2", A), team("t3", A)];
  // Perfect 3-way tie: every match 21-19/19-21.
  const matches = [
    groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 0], points: [42, 38] }),
    groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 0], points: [42, 38] }),
    groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 0], points: [42, 38] }),
  ];

  it("applies the organizer order and clears the unresolved flag", () => {
    const rows = computeZoneStandings(teams, matches, A, ["t3", "t1", "t2"]);
    assert.deepEqual(rows.map((r) => r.teamId), ["t3", "t1", "t2"]);
    assert.ok(rows.every((r) => !r.unresolvedTie));
  });

  it("ignores an order that does not match the tied teams", () => {
    for (const stale of [[], ["t1", "t2"], ["t1", "t2", "t3", "t1"], ["t1", "t2", "t9"]]) {
      const rows = computeZoneStandings(teams, matches, A, stale);
      assert.ok(
        rows.every((r) => r.unresolvedTie),
        `stale order ${JSON.stringify(stale)} must not reorder anything`,
      );
    }
  });
});
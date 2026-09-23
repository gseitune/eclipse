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
}): StandingInputMatch {
  return {
    stage: "GROUPS",
    zone: p.zone,
    teamAId: p.a,
    teamBId: p.b,
    setAScore: p.sets?.[0] ?? null,
    setBScore: p.sets?.[1] ?? null,
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

  it("head-to-head decides the tie even against a better set diff", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A), team("t4", A)];
    // t1 and t2 are both 2-1: t1 beat t2 head-to-head (2-1) but t2 has the
    // better overall set diff (+3 vs +1). H2H must rank t1 above.
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
      rows.indexOf(t1) < rows.indexOf(t2),
      "h2h winner ranks above despite the set diff",
    );
    assert.deepEqual(rows.map((r) => r.teamId), ["t1", "t2", "t3", "t4"]);
  });

  it("head-to-head works with WINNER_ONLY matches (winnerId only)", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A), team("t4", A)];
    // t1 and t2 are both 2-1; their direct match was WINNER_ONLY (no
    // scoreboard) and t1 won it, so t1 ranks above t2 despite t2 holding
    // the better complete-score set diff.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "WINNER_ONLY", winner: "t1" }),
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
      rows.indexOf(t1) < rows.indexOf(t2),
      "WINNER_ONLY h2h winner ranks above",
    );
    assert.deepEqual(rows.map((r) => r.teamId), ["t1", "t2", "t3", "t4"]);
  });

  it("cyclical head-to-head falls back to set diff and then the deterministic draw", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // Every team 1-1, same set diff, h2h cycle t1>t2>t3>t1: no metric
    // separates them, so the deterministic draw (name) decides.
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 1] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 1] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 1] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    assert.deepEqual(
      rows.map((r) => r.teamId),
      ["t1", "t2", "t3"],
      "deterministic draw: name ascending",
    );
    assert.ok(
      rows.every((r) => !r.unresolvedTie),
      "zone ties resolve deterministically now",
    );
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
});
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
  it("ranks by wins, then set difference, then head-to-head", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // t1 and t2 both 1-1 (tied on wins); t2 has the better set diff.
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

  it("uses head-to-head when wins and setDiff are equal", () => {
    const teams = [team("t1", A), team("t2", A), team("t3", A)];
    // Every team 1-1, same set diff (2-2 + h2h: t1 beat t2).
    const matches = [
      groupMatch({ a: "t1", b: "t2", zone: A, status: "COMPLETE", winner: "t1", sets: [2, 1] }),
      groupMatch({ a: "t2", b: "t3", zone: A, status: "COMPLETE", winner: "t2", sets: [2, 1] }),
      groupMatch({ a: "t3", b: "t1", zone: A, status: "COMPLETE", winner: "t3", sets: [2, 1] }),
    ];
    const rows = computeZoneStandings(teams, matches, A);
    // Cyclic head-to-head (t1>t2>t3>t1): cannot separate -> unresolved.
    assert.ok(
      rows.every((r) => r.unresolvedTie),
      "cycle must be flagged as unresolved",
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
        resultStatus: "COMPLETE",
        winnerId: "t1",
      },
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
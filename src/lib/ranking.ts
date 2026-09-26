import { prisma } from "./prisma";
import type { StandingRow } from "./standings";
import type { Zone } from "../generated/prisma/client";
import { getStandings } from "./back";

// POSITION_POINTS[i] = points for position i+1 (1-indexed). Positions > 10 floor at 10.
export const POSITION_POINTS: number[] = [100, 80, 65, 50, 40, 40, 30, 25, 10, 10];

export function positionPoints(position: number): number {
  if (position > POSITION_POINTS.length) return 10;
  return POSITION_POINTS[position - 1];
}

export interface EtapaPosition {
  teamId: string;
  teamName: string;
  maleName: string | null;
  femaleName: string | null;
  position: number;
  points: number;
  zone: Zone | null;
}

export interface EtapaPositions {
  id: string;
  name: string;
  date: string | null;
  sortOrder: number;
  finished: boolean;
  positions: EtapaPosition[];
}

export interface RankedTeam {
  teamId: string;
  teamName: string;
  points: number;
  appearances: number;
  bestPosition: number | null;
  etapas: { etapaId: string; etapaName: string; position: number; points: number }[];
}

export interface RankingResponse {
  scale: number[];
  ranking: RankedTeam[];
  etapas: EtapaPositions[];
}

/**
 * Determines whether an etapa is finished: its FINAL-stage match has a
 * resultStatus !== "PENDING".
 */
async function isEtapaFinished(etapaId: string): Promise<boolean> {
  const finalMatch = await prisma.match.findFirst({
    where: { etapaId, stage: "FINAL" },
    orderBy: { slot: "asc" },
    select: { resultStatus: true },
  });
  return finalMatch !== null && finalMatch.resultStatus !== "PENDING";
}

/**
 * Computes the final positions for one etapa purely from matches + standings.
 *
 * Final positions (product decision):
 *   1st = winner of FINAL; 2nd = loser of FINAL.
 *   3rd/4th = losers of SEMIFINAL_1 and SEMIFINAL_2, ordered by setDiff
 *     of their zone standings row (higher setDiff = better); tie-break
 *     by team name then id.
 *   5th+ = every team NOT in the bracket semis, ordered by position in its
 *     zone standings, THEN by setDiff desc, then teamName asc, then id asc.
 */
export function computeFinalPositions(
  matches: Array<{
    stage: string;
    teamAId: string | null;
    teamBId: string | null;
    winnerId: string | null;
    resultStatus: string;
  }>,
  standings: Partial<Record<Zone, StandingRow[]>>,
): EtapaPosition[] {
  // Find the FINAL match and the SEMIFINAL matches
  const finalMatch = matches.find(
    (m) => m.stage === "FINAL" && m.resultStatus !== "PENDING",
  );
  const semiMatches = matches.filter(
    (m) =>
      (m.stage === "SEMIFINAL_1" || m.stage === "SEMIFINAL_2") &&
      m.resultStatus !== "PENDING",
  );
  const bronzeMatch = matches.find(
    (m) => m.stage === "BRONZE" && m.resultStatus !== "PENDING",
  );

  if (!finalMatch || !finalMatch.teamAId || !finalMatch.teamBId) {
    return []; // not finished
  }

  const positions: EtapaPosition[] = [];

  // 1st = winner of FINAL, 2nd = loser of FINAL
  const winnerId = finalMatch.winnerId;
  const loserId =
    winnerId === finalMatch.teamAId ? finalMatch.teamBId : finalMatch.teamAId;

  // Collect semifinal losers (3rd/4th)
  const semiLosers: Array<{ teamId: string; teamName: string; setDiff: number }> = [];
  for (const sm of semiMatches) {
    if (!sm.teamAId || !sm.teamBId) continue;
    const loserId = sm.winnerId
      ? sm.winnerId === sm.teamAId
        ? sm.teamBId
        : sm.teamAId
      : null;
    if (loserId) {
      const row = getStandingRowForTeam(standings, loserId);
      semiLosers.push({
        teamId: loserId,
        teamName: row?.teamName ?? loserId,
        setDiff: row?.setDiff ?? 0,
      });
    }
  }
  semiLosers.sort((a, b) => b.setDiff - a.setDiff || a.teamName.localeCompare(b.teamName) || a.teamId.localeCompare(b.teamId));

  // Determine 3rd and 4th: BRONZE match overrides semifinal losers
  let thirdTeamId: string | null;
  let fourthTeamId: string | null;
  if (bronzeMatch && bronzeMatch.winnerId) {
    thirdTeamId = bronzeMatch.winnerId;
    fourthTeamId = bronzeMatch.winnerId === bronzeMatch.teamAId
      ? bronzeMatch.teamBId
      : bronzeMatch.teamAId;
  } else {
    thirdTeamId = semiLosers[0]?.teamId ?? null;
    fourthTeamId = semiLosers[1]?.teamId ?? null;
  }

  // 1st
  if (winnerId) {
    const winnerRow = getStandingRowForTeam(standings, winnerId);
    positions.push({
      teamId: winnerId,
      teamName: winnerRow?.teamName ?? winnerId,
      maleName: winnerRow?.maleName ?? null,
      femaleName: winnerRow?.femaleName ?? null,
      position: 1,
      points: positionPoints(1),
      zone: winnerRow?.zone ?? null,
    });
  }
  // 2nd
  if (loserId) {
    const loserRow = getStandingRowForTeam(standings, loserId);
    positions.push({
      teamId: loserId,
      teamName: loserRow?.teamName ?? loserId,
      maleName: loserRow?.maleName ?? null,
      femaleName: loserRow?.femaleName ?? null,
      position: 2,
      points: positionPoints(2),
      zone: loserRow?.zone ?? null,
    });
  }
  // 3rd
  if (thirdTeamId) {
    const row = getStandingRowForTeam(standings, thirdTeamId);
    positions.push({
      teamId: thirdTeamId,
      teamName: row?.teamName ?? thirdTeamId,
      maleName: row?.maleName ?? null,
      femaleName: row?.femaleName ?? null,
      position: 3,
      points: positionPoints(3),
      zone: row?.zone ?? null,
    });
  }
  // 4th
  if (fourthTeamId) {
    const row = getStandingRowForTeam(standings, fourthTeamId);
    positions.push({
      teamId: fourthTeamId,
      teamName: row?.teamName ?? fourthTeamId,
      maleName: row?.maleName ?? null,
      femaleName: row?.femaleName ?? null,
      position: 4,
      points: positionPoints(4),
      zone: row?.zone ?? null,
    });
  }

  // 5th+ = all teams NOT in bracket semis, ordered by zone standings position,
  // then setDiff desc, then teamName asc, then id asc.
  const bracketSet = new Set([
    finalMatch.teamAId, finalMatch.teamBId,
    ...semiMatches.flatMap((m) => [m.teamAId, m.teamBId].filter((id): id is string => id !== null)),
  ]);

  const allStandingTeams: Array<{ teamId: string; teamName: string; setDiff: number; zone: Zone | null; zoneRank: number; maleName: string | null; femaleName: string | null }> = [];
  for (const zone of ["A", "B", "C"] as Zone[]) {
    const rows = standings[zone];
    if (!rows) continue;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (bracketSet.has(r.teamId)) continue;
      allStandingTeams.push({
        teamId: r.teamId,
        teamName: r.teamName,
        setDiff: r.setDiff,
        zone: r.zone,
        zoneRank: i + 1,
        maleName: r.maleName ?? null,
        femaleName: r.femaleName ?? null,
      });
    }
  }

  allStandingTeams.sort((a, b) => {
    if (a.zoneRank !== b.zoneRank) return a.zoneRank - b.zoneRank;
    if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
    return a.teamName.localeCompare(b.teamName) || a.teamId.localeCompare(b.teamId);
  });

  let positionNum = 5;
  for (const team of allStandingTeams) {
    positions.push({
      teamId: team.teamId,
      teamName: team.teamName,
      maleName: team.maleName,
      femaleName: team.femaleName,
      position: positionNum++,
      points: positionPoints(positionNum - 1),
      zone: team.zone,
    });
  }

  positions.sort((a, b) => a.position - b.position);
  return positions;
}

function getStandingRowForTeam(
  standings: Partial<Record<Zone, StandingRow[]>>,
  teamId: string,
): StandingRow | undefined {
  for (const zone of Object.values(standings)) {
    const row = zone.find((r) => r.teamId === teamId);
    if (row) return row;
  }
  return undefined;
}

/**
 * Computes EtapaPositions for a single etapa from its id.
 * Returns null if the etapa doesn't exist.
 * Positions array is empty when the etapa is not finished.
 */
export async function getEtapaRanking(etapaId: string): Promise<EtapaPositions | null> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { id: true, name: true, date: true, sortOrder: true },
  });
  if (!etapa) return null;

  const finished = await isEtapaFinished(etapaId);

  if (!finished) {
    return {
      id: etapa.id,
      name: etapa.name,
      date: etapa.date ? etapa.date.toISOString() : null,
      sortOrder: etapa.sortOrder,
      finished: false,
      positions: [],
    };
  }

  // Read all matches and standings for this etapa
  const [matches, standings] = await Promise.all([
    prisma.match.findMany({
      where: { etapaId },
      select: {
        stage: true,
        teamAId: true,
        teamBId: true,
        winnerId: true,
        resultStatus: true,
      },
    }),
    getStandings(etapaId),
  ]);

  const positions = computeFinalPositions(matches, standings);

  return {
    id: etapa.id,
    name: etapa.name,
    date: etapa.date ? etapa.date.toISOString() : null,
    sortOrder: etapa.sortOrder,
    finished: true,
    positions,
  };
}

/**
 * Computes the annual ranking across all etapas.
 */
export async function getAnnualRanking(): Promise<RankingResponse> {
  const etapas = await prisma.etapa.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, sortOrder: true },
  });

  const scale = [...POSITION_POINTS];
  const ranking = new Map<string, RankedTeam>();
  const etapasResult: EtapaPositions[] = [];

  for (const etapa of etapas) {
    const etapaPositions = await getEtapaRanking(etapa.id);
    if (etapaPositions) {
      etapasResult.push(etapaPositions);
    }

    if (!etapaPositions || !etapaPositions.finished || etapaPositions.positions.length === 0) {
      continue;
    }

    for (const pos of etapaPositions.positions) {
      const existing = ranking.get(pos.teamId);
      if (!existing) {
        ranking.set(pos.teamId, {
          teamId: pos.teamId,
          teamName: pos.teamName,
          points: pos.points,
          appearances: 1,
          bestPosition: pos.position,
          etapas: [{ etapaId: etapa.id, etapaName: etapa.name, position: pos.position, points: pos.points }],
        });
      } else {
        existing.points += pos.points;
        existing.appearances += 1;
        if (pos.position < (existing.bestPosition ?? Infinity)) {
          existing.bestPosition = pos.position;
        }
        existing.etapas.push({ etapaId: etapa.id, etapaName: etapa.name, position: pos.position, points: pos.points });
      }
    }
  }

  const rankingArray = [...ranking.values()];
  rankingArray.sort(
    (a, b) =>
      b.points - a.points ||
      (a.bestPosition ?? Infinity) - (b.bestPosition ?? Infinity) ||
      a.teamName.localeCompare(b.teamName) ||
      a.teamId.localeCompare(b.teamId),
  );

  return {
    scale,
    ranking: rankingArray,
    etapas: etapasResult,
  };
}

/**
 * Front-only type module mirroring the exact API shapes.
 * Standalone types — no imports from src/generated/prisma.
 */

export type ZoneId = "A" | "B" | "C";

export type PhaseName = "GROUPS" | "DESEMPATE" | "ELIMINATORIES";

export type ResultStatus = "PENDING" | "WINNER_ONLY" | "COMPLETE";

export type Stage =
  | "GROUPS"
  | "DESEMPATE"
  | "SEMIFINAL_1"
  | "SEMIFINAL_2"
  | "FINAL";

export interface StandingRow {
  teamId: string;
  teamName: string;
  zone: ZoneId;
  played: number;
  won: number;
  lost: number;
  setDiff: number;
  unresolvedTie: boolean;
}

export interface ScheduleRow {
  id: string;
  slot: number;
  stage: string;
  scheduled: string | null;
  estimated: string | null;
  estimatedFromResult: boolean;
}

export interface TeamPublic {
  id: string;
  name: string;
  zone: ZoneId;
}

export interface MatchPlayer {
  id: string;
  name: string;
}

export interface MatchPublic {
  id: string;
  stage: Stage;
  zone: ZoneId | null;
  slot: number;
  timeLabel: string | null;
  teamAId: string | null;
  teamBId: string | null;
  teamA: MatchPlayer | null;
  teamB: MatchPlayer | null;
  setFormat: string | null;
  sets: { teamA: number; teamB: number }[] | null;
  resultStatus: ResultStatus;
  winnerId: string | null;
  winner: MatchPlayer | null;
  recordedAt: string | null;
}

export function setWins(sets: { teamA: number; teamB: number }[] | null | undefined): { a: number; b: number } {
  let a = 0;
  let b = 0;
  if (!sets) return { a, b };
  for (const s of sets) {
    if (s.teamA > s.teamB) a++;
    else if (s.teamB > s.teamA) b++;
  }
  return { a, b };
}

export interface DesempateMatchInfo {
  id: string;
  slot: number;
  teamA: MatchPlayer | null;
  teamB: MatchPlayer | null;
}

export interface DesempateInfo {
  needed: boolean;
  pending: boolean;
  match: DesempateMatchInfo | null;
}

export interface BracketsBlocked {
  reason: "three_seconds_tie";
  teamIds: string[];
}

export interface StateSnapshot {
  phase: string;
  zoneConfirmed: boolean;
  prepMinutes: number;
  matchMinutes: number;
  standings: Partial<Record<ZoneId, StandingRow[]>>;
  schedule: ScheduleRow[];
  brackets: MatchPublic[];
  nextMatch: MatchPublic | null;
  zones: Record<ZoneId, TeamPublic[]>;
  desempate: DesempateInfo;
  bracketsBlocked: BracketsBlocked | null;
  etapaId: string;
  etapa: EtapaMeta | null;
  etapas: EtapaMeta[];
}

export interface EtapaMeta {
  id: string;
  name: string;
  date: string | null;
  sortOrder: number;
  teamCount: number;
  closedAt: string | null;
}

export interface ZonesMapping {
  [teamId: string]: ZoneId;
}

export type ZonificationResponse = { mapping: ZonesMapping };

export type ResultResponse = {
  matchId: string;
  phaseChanged: boolean;
  bracketsChanged: boolean;
  desempateCreated: boolean;
  nextMatch: MatchPublic | null;
};

export type LoginResponse = { ok: true; email: string; username: string };

export type ApiErrorBody = { error: string };

export interface EtapaPositionRow {
  teamId: string;
  teamName: string;
  position: number;
  points: number;
  zone: ZoneId | null;
}

export interface EtapaPositions {
  id: string;
  name: string;
  date: string | null;
  sortOrder: number;
  finished: boolean;
  positions: EtapaPositionRow[];
}

export interface RankedTeam {
  teamId: string;
  teamName: string;
  points: number;
  appearances: number;
  bestPosition: number | null;
  etapas: EtapaPositionRow[];
}

export interface RankingResponse {
  scale: number[];
  ranking: RankedTeam[];
  etapas: EtapaPositions[];
}

/** Mixto fijo: each team carries one male + one female player name. */
export interface CreateTeamInput {
  name: string;
  maleName: string;
  femaleName: string;
}

export interface CreateEtapaInput {
  name: string;
  date: string | null;
  teams: CreateTeamInput[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

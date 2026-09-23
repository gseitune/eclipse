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
  setAScore: number | null;
  setBScore: number | null;
  resultStatus: ResultStatus;
  winnerId: string | null;
  winner: MatchPlayer | null;
  recordedAt: string | null;
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

export type LoginResponse = { ok: true; email: string };

export type ApiErrorBody = { error: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Front-only type module mirroring the exact API shapes.
 * Standalone types — no imports from src/generated/prisma.
 */

export type ZoneId = "A" | "B" | "C";

/** Circuit = annual season. Two circuits run per year, each with its own table. */
export type Circuit = "PRINCIPIANTES" | "INTERMEDIOS";

/**
 * Set format chosen when the etapa is created. `null` keeps the per-stage
 * convention used by etapas created before the choice existed.
 */
export type EtapaSetFormat =
  | "SINGLE_21"
  | "TWO_15_TIEBREAK"
  | "TWO_21_TIEBREAK_15"
  | "BEST_OF_3_21";

export type PhaseName = "GROUPS" | "DESEMPATE" | "ELIMINATORIES";

export type ResultStatus = "PENDING" | "WINNER_ONLY" | "COMPLETE";

export type Stage =
  | "GROUPS"
  | "DESEMPATE"
  | "SEMIFINAL_1"
  | "SEMIFINAL_2"
  | "FINAL"
  | "REPECHAJE_1"
  | "REPECHAJE_2"
  | "BRONZE"
  | "CUARTOS_1"
  | "CUARTOS_2"
  | "CUARTOS_3"
  | "CUARTOS_4";

export interface StandingRow {
  teamId: string;
  teamName: string;
  zone: ZoneId;
  played: number;
  won: number;
  lost: number;
  setDiff: number;
  /** Points for minus points against. COMPLETE matches only. */
  pointDiff: number;
  /** Total points scored. COMPLETE matches only. */
  pointsFor: number;
  unresolvedTie: boolean;
}

export interface ScheduleRow {
  id: string;
  slot: number;
  stage: string;
  scheduled: string | null;
  estimated: string | null;
  estimatedFromResult: boolean;
  /** Manual organizer times (ISO) — set via POST /api/matches/:id/times. */
  manualStartAt?: string | null;
  manualEndAt?: string | null;
  /** Who plays and how it ended. Present on the public schedule. */
  teamA?: { id: string; name: string } | null;
  teamB?: { id: string; name: string } | null;
  resultStatus?: string;
  sets?: { teamA: number; teamB: number }[] | null;
  winnerId?: string | null;
}

export interface TeamNamePair {
  id: string;
  name: string;
}

export interface ScheduleBoardRow {
  id: string;
  slot: number;
  stage: string;
  zone: string | null;
  scheduled: string | null;
  estimated: string | null;
  estimatedFromResult: boolean;
  teamA: TeamNamePair | null;
  teamB: TeamNamePair | null;
  setFormat: string | null;
  /** Full multi-set score; null for PENDING and WINNER_ONLY rows. */
  sets: { teamA: number; teamB: number }[] | null;
  resultStatus: string;
  editable: boolean;
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
  reason:
    | "three_seconds_tie"
    | "best_third_tie"
    | "best_third_needs_scores"
    | "zone_tie";
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
  /** Circuit = annual season: (circuit, season) identifies one circuit. */
  circuit: Circuit;
  season: number;
  sortOrder: number;
  teamCount: number;
  /** Set format fixed for the whole etapa; null = per-stage convention. */
  setFormat: EtapaSetFormat | null;
  closedAt: string | null;
  cancelledAt: string | null;
  /** True once any match of the etapa has a recorded result (fixture frozen). */
  played: boolean;
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

export interface EtapaPosition {
  teamId: string;
  teamName: string;
  maleName: string | null;
  femaleName: string | null;
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
  positions: EtapaPosition[];
}

export interface RankedPlayer {
  name: string;
  points: number;
  appearances: number;
  bestPosition: number | null;
  etapas: { etapaId: string; etapaName: string; position: number; points: number; teamName: string }[];
}

export interface RankingResponse {
  scale: number[];
  female: RankedPlayer[];
  male: RankedPlayer[];
  etapas: EtapaPositions[];
}

/** Mixto fijo: each team carries one male + one female player name. */
export interface CreateTeamInput {
  name: string;
  maleName: string;
  femaleName: string;
}

export type BracketFormat = "STANDARD" | "REPECHAJE" | "CUARTOS";

export interface CreateEtapaInput {
  name: string;
  date?: string | null;
  teams: CreateTeamInput[];
  bracketFormat?: BracketFormat;
  /** Circuit to create the etapa in; defaults to Principiantes. */
  circuit?: Circuit;
  /** Annual season; defaults to the current year. */
  season?: number;
  /** Set format for every match of the etapa; null keeps the stage convention. */
  setFormat?: EtapaSetFormat | null;
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
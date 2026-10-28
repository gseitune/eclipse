import type {
  StateSnapshot,
  ZonificationResponse,
  ResultResponse,
  LoginResponse,
  RankingResponse,
  EtapaMeta,
  CreateEtapaInput,
  ScheduleBoardRow,
  Circuit,
  ZoneId,
} from "./types";
import type { FotoGaleria } from "./galeria";
import { ApiError } from "./types";

export { ApiError };

const BASE = "/api";

/**
 * Reads the body as JSON without trusting it. A route that throws before
 * answering (no try/catch) answers 500 with an EMPTY body, and res.json()
 * then dies with "SyntaxError: Unexpected end of JSON input" — the operator
 * sees a parser bug instead of the real failure. Reading the text first lets
 * us answer with an ApiError that says what happened.
 */
async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new ApiError(
      res.status,
      `El servidor no devolvió datos (HTTP ${res.status}).`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      res.status,
      `El servidor devolvió una respuesta inválida (HTTP ${res.status}).`,
    );
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await parseJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchState(circuit?: Circuit): Promise<StateSnapshot> {
  const qs = circuit ? `?circuit=${circuit}` : "";
  const res = await fetch(`${BASE}/state${qs}`, { cache: "no-store" });
  return handleResponse<StateSnapshot>(res);
}

export async function fetchZonification(): Promise<ZonificationResponse> {
  const res = await fetch(`${BASE}/zonification`, { cache: "no-store" });
  return handleResponse<ZonificationResponse>(res);
}

export async function zonificationGenerate(): Promise<ZonificationResponse> {
  const res = await fetch(`${BASE}/zonification`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate" }),
    cache: "no-store",
  });
  return handleResponse<ZonificationResponse>(res);
}

export async function zonificationSwap(
  teamId: string,
  from: string,
  to: string,
): Promise<ZonificationResponse> {
  const res = await fetch(`${BASE}/zonification`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "swap", teamId, from, to }),
    cache: "no-store",
  });
  return handleResponse<ZonificationResponse>(res);
}

export async function zonificationConfirm(): Promise<ZonificationResponse> {
  const res = await fetch(`${BASE}/zonification`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "confirm" }),
    cache: "no-store",
  });
  return handleResponse<ZonificationResponse>(res);
}

export async function recordResult(input: {
  matchId: string;
  /** Full score path: setFormat is required when sets are provided. */
  setFormat?: string;
  /** Full score path: one entry per played set. */
  sets?: { teamA: number; teamB: number }[];
  /** Winner-only path: legal without sets (WINNER_ONLY). */
  winnerId?: string;
}): Promise<ResultResponse> {
  const body: Record<string, unknown> = { matchId: input.matchId };
  if (input.setFormat !== undefined) body.setFormat = input.setFormat;
  if (input.sets !== undefined) body.sets = input.sets;
  if (input.winnerId) body.winnerId = input.winnerId;
  const res = await fetch(`${BASE}/results`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return handleResponse<ResultResponse>(res);
}

/**
 * PATCH /api/results/:id — re-records the result of an already-played match.
 * `cascade: true` clears the invalidated descendant chain inside the same
 * transaction when that match is blocked (a descendant phase already played).
 */
export async function editResult(input: {
  matchId: string;
  /** Full score path: setFormat is required when sets are provided. */
  setFormat?: string;
  /** Full score path: one entry per played set. */
  sets?: { teamA: number; teamB: number }[];
  /** Winner-only path: legal without sets (WINNER_ONLY). */
  winnerId?: string;
  /** Let the correction clear the invalidated chain (default: false). */
  cascade?: boolean;
}): Promise<ResultResponse> {
  const body: Record<string, unknown> = {};
  if (input.setFormat !== undefined) body.setFormat = input.setFormat;
  if (input.sets !== undefined) body.sets = input.sets;
  if (input.winnerId) body.winnerId = input.winnerId;
  if (input.cascade) body.cascade = true;
  const res = await fetch(`${BASE}/results/${input.matchId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return handleResponse<ResultResponse>(res);
}

export async function login(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });
  return handleResponse<LoginResponse>(res);
}

export async function logout(): Promise<{ ok: true }> {
  const res = await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  return handleResponse<{ ok: true }>(res);
}

export async function fetchRanking(circuit?: Circuit, season?: number | null): Promise<RankingResponse> {
  const params = new URLSearchParams();
  if (circuit) params.set("circuit", circuit);
  if (season !== undefined && season !== null) params.set("season", String(season));
  const qs = params.toString();
  const res = await fetch(`${BASE}/ranking${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  return handleResponse<RankingResponse>(res);
}

export async function fetchEtapas(circuit?: Circuit): Promise<{ etapas: EtapaMeta[] }> {
  const qs = circuit ? `?circuit=${circuit}` : "";
  const res = await fetch(`${BASE}/etapas${qs}`, { cache: "no-store" });
  return handleResponse<{ etapas: EtapaMeta[] }>(res);
}

/** Public gallery of one circuit: the photos and the album link. */
export async function fetchGallery(
  circuit: Circuit,
): Promise<{ fotos: FotoGaleria[]; albumUrl: string }> {
  const res = await fetch(`${BASE}/gallery?circuit=${circuit}`, {
    cache: "no-store",
  });
  return handleResponse<{ fotos: FotoGaleria[]; albumUrl: string }>(res);
}

/** Organizer edits an etapa's metadata (name/date). Only while open and unplayed. */
export async function updateEtapa(
  etapaId: string,
  input: { name?: string; date?: string | null },
): Promise<{ etapa: EtapaMeta }> {
  const res = await fetch(`${BASE}/etapas/${etapaId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  return handleResponse<{ etapa: EtapaMeta }>(res);
}

export async function closeEtapa(
  etapaId: string,
): Promise<{ etapa: { id: string; name: string; closedAt: string | null } }> {
  const res = await fetch(`${BASE}/etapas/${etapaId}/close`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  return handleResponse(res);
}

/** Re-orders the group slots of an etapa to the interleaved rotation (pre-play only). */
export async function reslotEtapa(
  etapaId: string,
): Promise<{ moved: number; total: number }> {
  const res = await fetch(`${BASE}/etapas/${etapaId}/reslot`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  return handleResponse(res);
}

/** Organizer names the best third when the automatic selection ties. */
export async function resolveBestThird(
  etapaId: string,
  teamId: string,
): Promise<{ ok: boolean; missing: string[] }> {
  const res = await fetch(`${BASE}/best-third`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ etapaId, teamId }),
  });
  return handleResponse(res);
}

/** Organizer picks the "Desempate" path for a tied best third (2 teams). */
export async function createBestThirdDesempate(
  etapaId: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/best-third/desempate`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ etapaId }),
  });
  return handleResponse(res);
}

/** Organizer sets the manual order of a zone tie the engine cannot resolve. */
export async function resolveZoneTie(
  etapaId: string,
  zone: ZoneId,
  order: string[],
): Promise<{ ok: boolean; missing: string[] }> {
  const res = await fetch(`${BASE}/zone-tie`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ etapaId, zone, order }),
  });
  return handleResponse(res);
}

export async function cancelEtapa(
  etapaId: string,
  password: string,
): Promise<{ etapa: { id: string; name: string; cancelledAt: string | null } }> {
  const res = await fetch(`${BASE}/etapas/${etapaId}/cancel`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ password }),
  });
  return handleResponse(res);
}

/** Removes a cancelled etapa so its number can be loaded again. */
export async function deleteEtapa(etapaId: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/etapas/${etapaId}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  return handleResponse<{ id: string }>(res);
}

/** Drive folder stored for a circuit's public gallery (null = default album). */
export async function fetchGalleryFolder(
  circuit: Circuit,
): Promise<{ circuit: Circuit; folder: string | null }> {
  const res = await fetch(`${BASE}/settings/gallery?circuit=${circuit}`, {
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function saveGalleryFolder(
  circuit: Circuit,
  url: string,
): Promise<{ circuit: Circuit; folder: string | null }> {
  const res = await fetch(`${BASE}/settings/gallery`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ circuit, url }),
  });
  return handleResponse(res);
}

export async function createEtapa(input: CreateEtapaInput): Promise<{ etapa: { id: string; name: string } }> {
  const res = await fetch(`${BASE}/etapas`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return handleResponse(res);
}

/**
 * Registers a fecha suspended by weather: only number, date and circuit, with no
 * teams and no fixture. It is born cancelled.
 */
export async function createCancelledEtapa(input: {
  name: string;
  date: string;
  circuit?: Circuit;
  season?: number;
}): Promise<{ etapa: { id: string; name: string } }> {
  const res = await fetch(`${BASE}/etapas`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, cancelled: true }),
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function fetchScheduleBoard(etapaId?: string | null): Promise<{ schedule: ScheduleBoardRow[] }> {
  const qs = etapaId ? `?etapa=${encodeURIComponent(etapaId)}` : "";
  const res = await fetch(`${BASE}/schedule${qs}`, { cache: "no-store" });
  return handleResponse(res);
}

export async function rescheduleMatch(
  matchId: string,
  direction: "up" | "down",
): Promise<{ ok: true }> {
  const res = await fetch(`${BASE}/schedule/reorder`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId, direction }),
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function setMatchTimes(
  matchId: string,
  times: { startAt?: string | null; endAt?: string | null },
): Promise<{ match: { id: string; manualStartAt: string | null; manualEndAt: string | null } }> {
  const res = await fetch(`${BASE}/matches/${encodeURIComponent(matchId)}/times`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(times),
    cache: "no-store",
  });
  return handleResponse(res);
}

import type {
  StateSnapshot,
  ZonificationResponse,
  ResultResponse,
  LoginResponse,
} from "./types";
import { ApiError } from "./types";

export { ApiError };

const BASE = "/api";

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await parseJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchState(): Promise<StateSnapshot> {
  const res = await fetch(`${BASE}/state`, { cache: "no-store" });
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
  setFormat: string;
  sets: { teamA: number; teamB: number }[];
  winnerId?: string;
}): Promise<ResultResponse> {
  const body: Record<string, unknown> = {
    matchId: input.matchId,
    setFormat: input.setFormat,
    sets: input.sets,
  };
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

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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

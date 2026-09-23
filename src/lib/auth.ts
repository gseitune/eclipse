import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { prisma } from "./prisma";

/**
 * Organizer auth (multi-device).
 * - email + password, single role (organizer), no public signup.
 * - sessions are stateless signed cookies (HMAC): each device keeps its own
 *   cookie, so notebook + iPhone never invalidate each other.
 * - passwords: scrypt with a per-user salt (node:crypto, zero deps).
 */

const SESSION_COOKIE = "selvarena_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "dev-insecure-secret-change-me";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

interface SessionPayload {
  sub: string;
  email: string;
  exp: number;
}

function signPayload(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", authSecret())
    .update(body)
    .digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user: {
  id: string;
  email: string;
}): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return signPayload(payload);
}

export const sessionCookieName = SESSION_COOKIE;

export async function login(
  email: string,
  password: string,
): Promise<{ id: string; email: string } | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, email: user.email };
}
import { NextResponse } from "next/server";

import { createSessionToken, login, sessionCookieName } from "@/lib/auth";

/**
 * Throttle de intentos de login. Es en memoria y por instancia: en Vercel cada
 * instancia tiene su propio contador, así que no es una barrera perfecta, pero
 * corta el caso real (un bot martillando el mismo endpoint desde el mismo IP).
 * Si algún día hace falta algo estricto, hay que persistirlo en la base.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function attemptKey(request: Request, identifier: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  return `${ip}|${identifier.trim().toLowerCase()}`;
}

function tooManyAttempts(key: string): number | null {
  const entry = attempts.get(key);
  if (!entry) return null;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return null;
  }
  return entry.count >= MAX_ATTEMPTS ? Math.ceil((entry.resetAt - Date.now()) / 1000) : null;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
  // Limpieza barata para que el Map no crezca sin control.
  if (attempts.size > 500) {
    for (const [k, v] of attempts) {
      if (now > v.resetAt) attempts.delete(k);
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier : typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return NextResponse.json(
      { error: "identifier and password are required" },
      { status: 400 },
    );
  }

  const key = attemptKey(request, identifier);
  const retryAfter = tooManyAttempts(key);
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const user = await login(identifier, password);
  if (!user) {
    recordFailure(key);
    // Un pequeño freno extra: encarece el intento sin molestar a quien se
    // equivoca una vez con la contraseña.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  attempts.delete(key);
  const token = createSessionToken(user);
  const res = NextResponse.json({ ok: true, email: user.email, username: user.username });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    // En producción la cookie solo viaja por HTTPS; en local se omite para no
    // romper el desarrollo sobre http.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

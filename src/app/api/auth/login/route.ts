import { NextResponse } from "next/server";

import { createSessionToken, login, sessionCookieName } from "@/lib/auth";

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

  const user = await login(identifier, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken(user);
  const res = NextResponse.json({ ok: true, email: user.email, username: user.username });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
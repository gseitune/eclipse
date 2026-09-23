import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { recordResult } from "@/lib/back";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const matchId = typeof body?.matchId === "string" ? body.matchId : "";

  try {
    const result = await recordResult({
      matchId,
      setAScore:
        typeof body?.setAScore === "number" ? body.setAScore : null,
      setBScore:
        typeof body?.setBScore === "number" ? body.setBScore : null,
      winnerId:
        typeof body?.winnerId === "string" ? body.winnerId : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
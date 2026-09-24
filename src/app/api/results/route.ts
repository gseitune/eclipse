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
      setFormat:
        typeof body?.setFormat === "string" ? body.setFormat : null,
      sets: Array.isArray(body?.sets) ? body.sets : null,
      winnerId:
        typeof body?.winnerId === "string" ? body.winnerId : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    const reason = (error as { reason?: string }).reason;
    return NextResponse.json(
      reason ? { error: message, reason } : { error: message },
      { status },
    );
  }
}
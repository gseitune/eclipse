import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { reorderMatch } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * POST /api/schedule/reorder — organizer-only: reorder a match within
 * the day by swapping its slot with the nearest PENDING neighbor.
 * Body: { matchId: string, direction: "up" | "down" }
 */
export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const matchId = typeof body?.matchId === "string" ? body.matchId : "";
  const direction = body?.direction === "up" || body?.direction === "down" ? body.direction : null;

  if (!direction) {
    return NextResponse.json(
      { error: "direction must be 'up' or 'down'" },
      { status: 400 },
    );
  }

  try {
    await reorderMatch(matchId, direction);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Unexpected error";
    const reason = (error as { reason?: string }).reason;
    return NextResponse.json(
      reason ? { error: message, reason } : { error: message },
      { status },
    );
  }
}

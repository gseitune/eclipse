import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { reslotGroupSchedule } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * POST /api/etapas/:id/reslot — organizer-only: re-assigns the group slots of
 * an existing etapa to the interleaved rotation (A, B, C, …) so no team plays
 * two group matches back-to-back. Only valid before any group match is played.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    return NextResponse.json(await reslotGroupSchedule(id));
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

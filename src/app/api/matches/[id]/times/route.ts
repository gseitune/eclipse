import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishSse } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/matches/:id/times — organizer-only: sets manual start/end
 * times for a match. Partial updates: only set a field when the key
 * is present in the body (`startAt !== undefined`).
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
    const user = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: { etapa: true },
    });
    if (!match) {
      return NextResponse.json(
        { error: "Match not found.", reason: "unknown_match" },
        { status: 404 },
      );
    }

    if (match.etapa.cancelledAt) {
      return NextResponse.json(
        { error: "Etapa ya cancelada.", reason: "etapa_cancelled" },
        { status: 409 },
      );
    }
    if (match.etapa.closedAt) {
      return NextResponse.json(
        { error: "Circuito cerrado: la etapa ya no admite modificaciones.", reason: "etapa_cerrada" },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => null);
    const { startAt, endAt } = body ?? {};

    // Validate dates when provided
    let parsedStart: Date | null = null;
    let parsedEnd: Date | null = null;

    if (startAt !== undefined) {
      if (startAt !== null) {
        parsedStart = new Date(startAt);
        if (Number.isNaN(parsedStart.getTime())) {
          return NextResponse.json(
            { error: "Invalid date.", reason: "invalid_date" },
            { status: 400 },
          );
        }
      }
    }

    if (endAt !== undefined) {
      if (endAt !== null) {
        parsedEnd = new Date(endAt);
        if (Number.isNaN(parsedEnd.getTime())) {
          return NextResponse.json(
            { error: "Invalid date.", reason: "invalid_date" },
            { status: 400 },
          );
        }
      }
    }

    // Validate range when both are present and non-null
    if (parsedStart !== null && parsedEnd !== null && parsedEnd <= parsedStart) {
      return NextResponse.json(
        { error: "End time must be after start time.", reason: "invalid_range" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (startAt !== undefined) {
      updateData.manualStartAt = parsedStart;
    }
    if (endAt !== undefined) {
      updateData.manualEndAt = parsedEnd;
    }

    const updated = await prisma.match.update({
      where: { id },
      data: updateData,
      include: { etapa: true },
    });

    publishSse("match-times-changed", { matchId: match.id });

    return NextResponse.json({ match: updated });
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

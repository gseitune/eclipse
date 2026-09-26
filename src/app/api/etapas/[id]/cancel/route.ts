import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishSse } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/etapas/:id/cancel — organizer-only: cancels the etapa
 * (weather suspension) after password verification.
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
    const etapa = await prisma.etapa.findUnique({
      where: { id },
      select: { id: true, name: true, closedAt: true, cancelledAt: true },
    });
    if (!etapa) {
      return NextResponse.json(
        { error: "Etapa not found.", reason: "unknown_etapa" },
        { status: 404 },
      );
    }
    if (etapa.closedAt) {
      return NextResponse.json(
        { error: "Circuito cerrado: la etapa ya no admite modificaciones.", reason: "etapa_cerrada" },
        { status: 409 },
      );
    }
    if (etapa.cancelledAt) {
      return NextResponse.json(
        { error: "Etapa ya cancelada.", reason: "etapa_cancelled" },
        { status: 409 },
      );
    }

    const body = await request.json();
    const password = body?.password;
    if (!password) {
      return NextResponse.json(
        { error: "Password is required.", reason: "password_required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect password.", reason: "unauthorized" },
        { status: 401 },
      );
    }

    const updated = await prisma.etapa.update({
      where: { id },
      data: { cancelledAt: new Date() },
      select: { id: true, name: true, cancelledAt: true },
    });

    publishSse("etapa-cancelled", { etapaId: id });

    return NextResponse.json({ etapa: updated });
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

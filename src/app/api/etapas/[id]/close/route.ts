import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishSse } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/etapas/:id/close — organizer-only: marks the etapa as
 * immutable (closedAt = now). Requires the FINAL match to have a
 * result.
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
      select: { id: true, name: true, closedAt: true },
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

    // Check that the FINAL has a result
    const finalMatch = await prisma.match.findFirst({
      where: { etapaId: id, stage: "FINAL" },
      orderBy: { slot: "asc" },
      select: { resultStatus: true },
    });
    if (!finalMatch || finalMatch.resultStatus === "PENDING") {
      return NextResponse.json(
        { error: "Cannot close an unfinished etapa: the FINAL has no result yet.", reason: "etapa_activa" },
        { status: 409 },
      );
    }

    const updated = await prisma.etapa.update({
      where: { id },
      data: { closedAt: new Date() },
      select: { id: true, name: true, closedAt: true },
    });

    publishSse("etapa-closed", { etapaId: id, name: updated.name });

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

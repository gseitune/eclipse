import { NextRequest, NextResponse } from "next/server";

import type { Zone } from "@/generated/prisma/client";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { resolveZoneTie } from "@/lib/back";

export const dynamic = "force-dynamic";

const ZONES: readonly string[] = ["A", "B", "C"];

/**
 * Organizer sets the manual order of a zone tie the engine cannot resolve.
 * The system only waits: it never picks by name, id or draw.
 */
export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const etapaId = typeof body?.etapaId === "string" ? body.etapaId : null;
  const zone =
    typeof body?.zone === "string" && ZONES.includes(body.zone)
      ? (body.zone as Zone)
      : null;
  const order =
    Array.isArray(body?.order) &&
    body.order.every((id: unknown) => typeof id === "string")
      ? (body.order as string[])
      : null;
  if (!etapaId || !zone || !order) {
    return NextResponse.json(
      { error: "etapaId, zone and order are required" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await resolveZoneTie(etapaId, zone, order));
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}

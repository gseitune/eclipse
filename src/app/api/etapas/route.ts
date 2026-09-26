import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { createEtapa, listEtapas } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * GET /api/etapas — public list of circuit stages (meta, newest last).
 * POST /api/etapas — organizer-only: creates a full etapa (teams → zones →
 * group round-robin fixture + bracket slots). Body:
 *   {
 *     name: string,
 *     date?: string | null,
 *     teams: { name: string, maleName: string, femaleName: string }[]
 *   }
 * Mixto fijo: every team needs one male and one female player name.
 */
export async function GET() {
  return NextResponse.json({ etapas: await listEtapas() });
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const teams = Array.isArray(body?.teams)
    ? body.teams.filter(
        (t: unknown): t is { name: string; maleName: string; femaleName: string } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as { name?: unknown }).name === "string" &&
          typeof (t as { maleName?: unknown }).maleName === "string" &&
          typeof (t as { femaleName?: unknown }).femaleName === "string",
      )
    : [];
  const date = typeof body?.date === "string" ? body.date : null;

  try {
    const etapa = await createEtapa({
      name,
      teams,
      ...(date !== null ? { date } : {}),
    });
    return NextResponse.json({ etapa }, { status: 201 });
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
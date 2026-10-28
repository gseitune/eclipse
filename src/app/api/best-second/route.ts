import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { resolveBestSecond } from "@/lib/back";

export const dynamic = "force-dynamic";

/** Organizer names the best second when the three runners-up tie. */
export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const etapaId = typeof body?.etapaId === "string" ? body.etapaId : null;
  const teamId = typeof body?.teamId === "string" ? body.teamId : null;
  if (!etapaId || !teamId) {
    return NextResponse.json(
      { error: "etapaId and teamId are required" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await resolveBestSecond(etapaId, teamId));
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}

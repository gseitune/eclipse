import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { createBestThirdDesempate } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * Organizer picks the "Desempate" path for a tied best third (CUARTOS, exactly
 * two ties). Creates the DESEMPATE match; its result resolves the bracket.
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
  if (!etapaId) {
    return NextResponse.json(
      { error: "etapaId is required" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createBestThirdDesempate(etapaId));
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}

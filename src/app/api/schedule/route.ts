import { NextRequest, NextResponse } from "next/server";

import { getScheduleBoard } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * GET /api/schedule — returns the day board: all matches ordered by slot,
 * each with windows, teams, and result status.
 */
export async function GET(request: NextRequest) {
  const etapa = request.nextUrl.searchParams.get("etapa");
  try {
    return NextResponse.json({ schedule: await getScheduleBoard(etapa ?? null) });
  } catch (error) {
    // Without this, a throw leaves the client with an empty 500: the panel
    // then reports a JSON parse error instead of the real database failure.
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = (error as { status?: number }).status ?? 500;
    console.error("GET /api/schedule failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}

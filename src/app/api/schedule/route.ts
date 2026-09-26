import { NextRequest, NextResponse } from "next/server";

import { getScheduleBoard } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * GET /api/schedule — returns the day board: all matches ordered by slot,
 * each with windows, teams, and result status.
 */
export async function GET(request: NextRequest) {
  const etapa = request.nextUrl.searchParams.get("etapa");
  return NextResponse.json({ schedule: await getScheduleBoard(etapa ?? null) });
}

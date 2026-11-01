import { NextRequest, NextResponse } from "next/server";

import { getScheduleBoard } from "@/lib/back";
import type { Circuit } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CIRCUITS: readonly Circuit[] = ["PRINCIPIANTES", "INTERMEDIOS"];

/**
 * GET /api/schedule — returns the day board: all matches ordered by slot,
 * each with windows, teams, and result status.
 *
 * `circuit` scopes the fallback when no explicit etapa is given. Without it the
 * board silently resolves the newest Principiantes stage, which is not what a
 * panel switched to Intermedios is asking for.
 */
export async function GET(request: NextRequest) {
  const etapa = request.nextUrl.searchParams.get("etapa");
  const circuitParam = request.nextUrl.searchParams.get("circuit");

  if (
    circuitParam !== null &&
    circuitParam !== "" &&
    !CIRCUITS.includes(circuitParam as Circuit)
  ) {
    return NextResponse.json({ error: "Invalid circuit." }, { status: 400 });
  }
  const circuit = (circuitParam || undefined) as Circuit | undefined;

  try {
    return NextResponse.json({
      schedule: await getScheduleBoard(etapa ?? null, circuit),
    });
  } catch (error) {
    // Without this, a throw leaves the client with an empty 500: the panel
    // then reports a JSON parse error instead of the real database failure.
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = (error as { status?: number }).status ?? 500;
    console.error("GET /api/schedule failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { getStateSnapshot } from "@/lib/back";
import type { Circuit } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CIRCUITS: readonly Circuit[] = ["PRINCIPIANTES", "INTERMEDIOS"];

/**
 * GET /api/state?etapa=&circuit=&season=
 * `circuit` picks the annual circuit when no explicit etapa is given: without
 * it, a request from Intermedios would silently read the Principiantes stage.
 */
export async function GET(request: NextRequest) {
  const etapa = request.nextUrl.searchParams.get("etapa");
  const circuitParam = request.nextUrl.searchParams.get("circuit");
  const seasonParam = request.nextUrl.searchParams.get("season");

  if (
    circuitParam !== null &&
    circuitParam !== "" &&
    !CIRCUITS.includes(circuitParam as Circuit)
  ) {
    return NextResponse.json({ error: "Invalid circuit." }, { status: 400 });
  }
  const circuit = (circuitParam || "PRINCIPIANTES") as Circuit;

  let season: number | null = null;
  if (seasonParam !== null && seasonParam !== "") {
    const parsed = Number(seasonParam);
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
      return NextResponse.json({ error: "Invalid season." }, { status: 400 });
    }
    season = parsed;
  }

  try {
    return NextResponse.json(await getStateSnapshot(etapa, circuit, season));
  } catch (error) {
    // Without this, a throw leaves the client with an empty 500 and no clue.
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = (error as { status?: number }).status ?? 500;
    console.error("GET /api/state failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}

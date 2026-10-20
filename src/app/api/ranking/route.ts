import { NextRequest, NextResponse } from "next/server";

import { getAnnualRanking } from "@/lib/ranking";
import type { Circuit } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CIRCUITS: readonly Circuit[] = ["PRINCIPIANTES", "INTERMEDIOS"];

/**
 * GET /api/ranking?circuit=&season= — public annual table of ONE circuit.
 * Each circuit has its own points: the two tables are never mixed.
 */
export async function GET(request: NextRequest) {
  const circuitParam = request.nextUrl.searchParams.get("circuit");
  const seasonParam = request.nextUrl.searchParams.get("season");

  if (
    circuitParam !== null &&
    circuitParam !== "" &&
    !CIRCUITS.includes(circuitParam as Circuit)
  ) {
    return NextResponse.json({ error: "Invalid circuit." }, { status: 400 });
  }

  let season: number | null = null;
  if (seasonParam !== null && seasonParam !== "") {
    const parsed = Number(seasonParam);
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
      return NextResponse.json({ error: "Invalid season." }, { status: 400 });
    }
    season = parsed;
  }

  try {
    const circuit = (circuitParam || "PRINCIPIANTES") as Circuit;
    return NextResponse.json(await getAnnualRanking(circuit, season));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { getAnnualRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

/**
 * GET /api/ranking — public annual ranking: scale, ranked teams,
 * and per-etapa positions.
 */
export async function GET() {
  try {
    return NextResponse.json(await getAnnualRanking());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

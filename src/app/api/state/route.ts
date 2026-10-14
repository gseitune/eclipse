import { NextRequest, NextResponse } from "next/server";

import { getStateSnapshot } from "@/lib/back";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const etapa = request.nextUrl.searchParams.get("etapa");
  try {
    return NextResponse.json(await getStateSnapshot(etapa));
  } catch (error) {
    // Without this, a throw leaves the client with an empty 500 and no clue.
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/state failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
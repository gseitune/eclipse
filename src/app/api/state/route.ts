import { NextRequest, NextResponse } from "next/server";

import { getStateSnapshot } from "@/lib/back";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const etapa = request.nextUrl.searchParams.get("etapa");
  return NextResponse.json(await getStateSnapshot(etapa));
}
import { NextResponse } from "next/server";

import { getStateSnapshot } from "@/lib/back";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getStateSnapshot());
}
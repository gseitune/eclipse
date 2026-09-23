import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import {
  confirmZonification,
  generateZones,
  getTeamsByZone,
  swapTeam,
} from "@/lib/back";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ zones: await getTeamsByZone() });
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    if (action === "generate") {
      const mapping = await generateZones();
      return NextResponse.json({ mapping });
    }
    if (action === "swap") {
      const mapping = await swapTeam(
        String(body.teamId ?? ""),
        String(body.from ?? ""),
        String(body.to ?? ""),
      );
      return NextResponse.json({ mapping });
    }
    if (action === "confirm") {
      return NextResponse.json(await confirmZonification());
    }
    return NextResponse.json(
      { error: "action must be generate | swap | confirm" },
      { status: 400 },
    );
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status });
  }
}
import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { getGalleryFolder, setGalleryFolder } from "@/lib/back";
import type { Circuit } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CIRCUITS: readonly Circuit[] = ["PRINCIPIANTES", "INTERMEDIOS"];

function readCircuit(value: unknown): Circuit | null {
  if (value === null || value === undefined || value === "") return "PRINCIPIANTES";
  return typeof value === "string" && CIRCUITS.includes(value as Circuit)
    ? (value as Circuit)
    : null;
}

/**
 * GET /api/settings/gallery?circuit=  — organizer-only: the Drive folder stored
 * for that circuit (null when the deployment default applies).
 * PATCH — organizer-only: stores the folder; accepts the full Drive URL or the
 * bare id, and an empty string clears the override.
 */
export async function GET(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const circuit = readCircuit(request.nextUrl.searchParams.get("circuit"));
  if (circuit === null) {
    return NextResponse.json({ error: "Invalid circuit." }, { status: 400 });
  }

  return NextResponse.json({
    circuit,
    folder: await getGalleryFolder(circuit),
  });
}

export async function PATCH(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const circuit = readCircuit(body?.circuit);
  if (circuit === null) {
    return NextResponse.json({ error: "Invalid circuit." }, { status: 400 });
  }
  const raw = body?.url;
  if (raw !== null && raw !== undefined && typeof raw !== "string") {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }

  try {
    const folder = await setGalleryFolder(
      circuit,
      typeof raw === "string" ? raw : null,
    );
    return NextResponse.json({ circuit, folder });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Unexpected error";
    const reason = (error as { reason?: string }).reason;
    return NextResponse.json(
      reason ? { error: message, reason } : { error: message },
      { status },
    );
  }
}

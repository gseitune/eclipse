import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { updateEtapaMeta } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/etapas/:id — organizer-only: edits the etapa metadata (name and/or
 * date). Allowed only while the etapa is open and unplayed; the roster can never
 * be edited here: a team loaded into an etapa is frozen and only changes between
 * etapas. The body is forwarded as-is so the back layer is the single authority
 * on which fields are editable (it answers 400 field_not_editable otherwise).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid body.", reason: "invalid_body" },
        { status: 400 },
      );
    }

    const etapa = await updateEtapaMeta(id, body);
    return NextResponse.json({ etapa });
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

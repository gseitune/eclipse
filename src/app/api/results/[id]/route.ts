import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { editResult } from "@/lib/back";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/results/:id — re-records the result of an already-played match.
 * Same payload rules as POST /api/results (full score | explicit winner, never
 * partial). Guards return 409 with a clear `reason`:
 * - no_result_to_edit: the match has no result yet;
 * - editing_blocks_bracket: a descendant phase already played.
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/results/[id]">,
) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);

  try {
    const result = await editResult({
      matchId: id,
      setFormat:
        typeof body?.setFormat === "string" ? body.setFormat : null,
      sets: Array.isArray(body?.sets) ? body.sets : null,
      winnerId:
        typeof body?.winnerId === "string" ? body.winnerId : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    const reason = (error as { reason?: string }).reason;
    return NextResponse.json(
      reason ? { error: message, reason } : { error: message },
      { status },
    );
  }
}
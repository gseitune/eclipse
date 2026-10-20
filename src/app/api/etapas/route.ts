import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { createCancelledEtapa, createEtapa, listEtapas } from "@/lib/back";
import type { Circuit, SetFormat } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CIRCUITS: readonly Circuit[] = ["PRINCIPIANTES", "INTERMEDIOS"];
const SET_FORMATS: readonly SetFormat[] = [
  "SINGLE_21",
  "TWO_15_TIEBREAK",
  "TWO_21_TIEBREAK_15",
  "BEST_OF_3_21",
];
const BRACKET_FORMATS = ["STANDARD", "REPECHAJE", "CUARTOS"] as const;

/** `?circuit=` is a circuit (annual season) selector; unknown values are a 400. */
function readCircuit(value: string | null): Circuit | null {
  if (value === null || value === "") return "PRINCIPIANTES";
  return CIRCUITS.includes(value as Circuit) ? (value as Circuit) : null;
}

function readSeason(value: string | null): number | null | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : null;
}

/**
 * GET /api/etapas?circuit=&season= — public list of the stages of one circuit
 * (annual season), newest last.
 *
 * POST /api/etapas — organizer-only: creates a full etapa (teams → zones →
 * group round-robin fixture + bracket slots). Body:
 *   {
 *     name: string,
 *     date?: string | null,
 *     circuit?: "PRINCIPIANTES" | "INTERMEDIOS",
 *     season?: number,
 *     bracketFormat?: "STANDARD" | "REPECHAJE" | "CUARTOS",
 *     setFormat?: "SINGLE_21" | "TWO_15_TIEBREAK" | "TWO_21_TIEBREAK_15" | "BEST_OF_3_21" | null,
 *     teams: { name: string, maleName: string, femaleName: string }[]
 *   }
 * Mixto fijo: every team needs one male and one female player name.
 */
export async function GET(request: NextRequest) {
  const circuit = readCircuit(request.nextUrl.searchParams.get("circuit"));
  const season = readSeason(request.nextUrl.searchParams.get("season"));
  if (circuit === null || season === null) {
    return NextResponse.json({ error: "Invalid circuit or season." }, { status: 400 });
  }
  return NextResponse.json({ etapas: await listEtapas(circuit, season) });
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const date = typeof body?.date === "string" ? body.date : null;

  const circuit = readCircuit(
    typeof body?.circuit === "string" ? body.circuit : null,
  );
  const season =
    body?.season === undefined
      ? undefined
      : readSeason(String(body.season));
  if (circuit === null || season === null) {
    return NextResponse.json({ error: "Invalid circuit or season." }, { status: 400 });
  }

  // A weather-cancelled etapa only carries its number and date: it never had a
  // roster, so it is created already cancelled and without a fixture.
  if (body?.cancelled === true) {
    try {
      const etapa = await createCancelledEtapa({
        name,
        ...(date !== null ? { date } : {}),
        circuit,
        ...(season !== undefined ? { season } : {}),
      });
      return NextResponse.json({ etapa }, { status: 201 });
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

  const teams = Array.isArray(body?.teams)
    ? body.teams.filter(
        (t: unknown): t is { name: string; maleName: string; femaleName: string } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as { name?: unknown }).name === "string" &&
          typeof (t as { maleName?: unknown }).maleName === "string" &&
          typeof (t as { femaleName?: unknown }).femaleName === "string",
      )
    : [];

  // The bracket format has to reach the back layer: dropping it here silently
  // created every etapa as STANDARD even when the organizer chose otherwise.
  const bracketFormat =
    typeof body?.bracketFormat === "string" &&
    (BRACKET_FORMATS as readonly string[]).includes(body.bracketFormat)
      ? (body.bracketFormat as (typeof BRACKET_FORMATS)[number])
      : undefined;

  const setFormat =
    body?.setFormat === null || body?.setFormat === undefined
      ? null
      : typeof body.setFormat === "string" &&
          (SET_FORMATS as readonly string[]).includes(body.setFormat)
        ? (body.setFormat as SetFormat)
        : undefined;
  if (setFormat === undefined) {
    return NextResponse.json({ error: "Invalid set format." }, { status: 400 });
  }

  try {
    const etapa = await createEtapa({
      name,
      teams,
      ...(date !== null ? { date } : {}),
      ...(bracketFormat ? { bracketFormat } : {}),
      circuit,
      ...(season !== undefined ? { season } : {}),
      setFormat,
    });
    return NextResponse.json({ etapa }, { status: 201 });
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

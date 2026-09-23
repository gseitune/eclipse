import { NextResponse } from "next/server";

import {
  getBracketsSnapshot,
  getNextMatch,
  getSchedule,
  getStandings,
  getState,
  getTeamsByZone,
} from "@/lib/back";

export const dynamic = "force-dynamic";

export async function GET() {
  const [state, standings, schedule, brackets, nextMatch, zones] =
    await Promise.all([
      getState(),
      getStandings(),
      getSchedule(),
      getBracketsSnapshot(),
      getNextMatch(),
      getTeamsByZone(),
    ]);

  return NextResponse.json({
    phase: state.phase,
    zoneConfirmed: state.zoneConfirmed,
    prepMinutes: state.prepMinutes,
    matchMinutes: state.matchMinutes,
    standings,
    schedule,
    brackets,
    nextMatch,
    zones,
  });
}
"use client";

import { useMemo } from "react";
import { stageLabel } from "@/lib/front/phase";
import type { DesempateInfo, DesempateMatchInfo, MatchPublic, ScheduleRow } from "@/lib/front/types";
import { setWins } from "@/lib/front/types";

interface MatchTickerProps {
  schedule: ScheduleRow[];
  brackets: MatchPublic[];
  nextMatch: MatchPublic | null;
  desempate: DesempateInfo;
}

/**
 * Build a lookup map of matchId -> MatchPublic from brackets and nextMatch.
 * DesempateMatchInfo is handled separately since it is a lighter shape.
 */
function buildMatchMap(
  schedule: ScheduleRow[],
  brackets: MatchPublic[],
  nextMatch: MatchPublic | null,
): Map<string, MatchPublic> {
  const map = new Map<string, MatchPublic>();
  // The public schedule carries every match of the etapa (group stage included)
  // with its teams and its result, so it is the primary source; the bracket
  // payload then refines the knockout stages.
  for (const row of schedule) {
    map.set(row.id, {
      id: row.id,
      stage: row.stage as MatchPublic["stage"],
      zone: null,
      slot: row.slot,
      timeLabel: null,
      teamAId: row.teamA?.id ?? null,
      teamBId: row.teamB?.id ?? null,
      teamA: row.teamA ?? null,
      teamB: row.teamB ?? null,
      setFormat: null,
      sets: row.sets ?? null,
      resultStatus: (row.resultStatus ?? "PENDING") as MatchPublic["resultStatus"],
      winnerId: row.winnerId ?? null,
      winner:
        row.winnerId && row.teamA?.id === row.winnerId
          ? row.teamA
          : row.winnerId && row.teamB?.id === row.winnerId
            ? row.teamB
            : null,
      recordedAt: null,
    });
  }
  for (const b of brackets) map.set(b.id, b);
  if (nextMatch) map.set(nextMatch.id, nextMatch);
  return map;
}

function getTeams(
  matchId: string,
  map: Map<string, MatchPublic>,
  despMatch: DesempateMatchInfo | null,
): { teamA: string | null; teamB: string | null } {
  const m = map.get(matchId);
  if (m) return { teamA: m.teamA?.name ?? null, teamB: m.teamB?.name ?? null };
  if (despMatch && despMatch.id === matchId) {
    return {
      teamA: despMatch.teamA?.name ?? null,
      teamB: despMatch.teamB?.name ?? null,
    };
  }
  return { teamA: null, teamB: null };
}

function getResult(
  matchId: string,
  map: Map<string, MatchPublic>,
  despMatch: DesempateMatchInfo | null,
): { status: MatchPublic["resultStatus"] | null; setA: number | null; setB: number | null; winnerName: string | null } {
  const m = map.get(matchId);
  if (m) {
    const sw = setWins(m.sets);
    return {
      status: m.resultStatus,
      setA: sw.a,
      setB: sw.b,
      winnerName: m.winner?.name ?? null,
    };
  }
  if (despMatch && despMatch.id === matchId) {
    return { status: "PENDING", setA: null, setB: null, winnerName: null };
  }
  return { status: null, setA: null, setB: null, winnerName: null };
}

/** Internal representation of what the ticker needs to render for a slot */
type SlotInfo = { row: ScheduleRow } & (
  | { kind: "known"; match: MatchPublic }
  | { kind: "desempate"; despMatch: DesempateMatchInfo }
);

export function MatchTicker({
  schedule,
  brackets,
  nextMatch,
  desempate,
}: MatchTickerProps) {
  const matchMap = useMemo(
    () => buildMatchMap(schedule, brackets, nextMatch),
    [schedule, brackets, nextMatch],
  );

  const despMatch = desempate.match;

  const { previous, next } = useMemo(() => {
    // --- Previous: last decided match of the schedule ---
    let previousSlot: SlotInfo | null = null;
    for (let i = schedule.length - 1; i >= 0; i--) {
      const row = schedule[i];
      const m = matchMap.get(row.id);
      if (m && (m.resultStatus === "COMPLETE" || m.resultStatus === "WINNER_ONLY")) {
        previousSlot = { row, kind: "known", match: m };
        break;
      }
    }

    // --- Next: first pending match of the schedule ---
    let nextSlot: SlotInfo | null = null;
    for (let i = 0; i < schedule.length; i++) {
      const row = schedule[i];
      const m = matchMap.get(row.id);
      if (m && m.resultStatus === "PENDING") {
        nextSlot = { row, kind: "known", match: m };
        break;
      }
    }

    return { previous: previousSlot, next: nextSlot };
  }, [schedule, matchMap]);

  return (
    <section aria-label="Marcador" className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
      <h2 className="text-lg font-semibold text-stone-900">Marcador</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Previous block */}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Anterior</span>
          {previous ? (
            <KnownMatchBlock
              slot={previous}
              matchMap={matchMap}
              despMatch={despMatch}
            />
          ) : (
            <p className="text-sm text-stone-400">Sin resultados todavía</p>
          )}
        </div>

        {/* Next block */}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Próximo</span>
          {next ? (
            <KnownMatchBlock
              slot={next}
              matchMap={matchMap}
              despMatch={despMatch}
            />
          ) : (
            <p className="text-sm text-stone-400">Próximamente…</p>
          )}
        </div>
      </div>
    </section>
  );
}

function KnownMatchBlock({
  slot,
  matchMap,
  despMatch,
}: {
  slot: SlotInfo & { kind: "known" };
  matchMap: Map<string, MatchPublic>;
  despMatch: DesempateMatchInfo | null;
}) {
  const teams = getTeams(slot.match.id, matchMap, despMatch);
  const result = getResult(slot.match.id, matchMap, despMatch);
  const teamAName = teams.teamA ?? "—";
  const teamBName = teams.teamB ?? "—";
  const windowText = slot.row.estimated ?? slot.row.scheduled;

  const resultLine = (() => {
    if (result.status === "COMPLETE") {
      return `${result.setA ?? "—"} - ${result.setB ?? "—"}`;
    }
    if (result.status === "WINNER_ONLY" && result.winnerName) {
      return `Ganó ${result.winnerName}`;
    }
    if (result.status === "WINNER_ONLY") {
      return "Ganó";
    }
    return stageLabel(slot.match.stage);
  })();

  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-stone-700">
        <span className="text-stone-900">{teamAName}</span>
        {" vs "}
        <span className="text-stone-900">{teamBName}</span>
      </p>
      <p className="text-xs text-stone-500">{resultLine}</p>
      {windowText && (
        <p className="text-[11px] text-stone-400">{windowText}</p>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { liveMatchIds } from "@/lib/front/live";
import { stageLabel } from "@/lib/front/phase";
import type { DesempateInfo, DesempateMatchInfo, MatchPublic, ScheduleRow } from "@/lib/front/types";
import { setWins } from "@/lib/front/types";

interface MatchTickerProps {
  schedule: ScheduleRow[];
  brackets: MatchPublic[];
  nextMatch: MatchPublic | null;
  desempate: DesempateInfo;
  matchMinutes: number;
}

/**
 * Build a lookup map of matchId -> MatchPublic from brackets and nextMatch.
 * DesempateMatchInfo is handled separately since it is a lighter shape.
 */
function buildMatchMap(
  brackets: MatchPublic[],
  nextMatch: MatchPublic | null,
): Map<string, MatchPublic> {
  const map = new Map<string, MatchPublic>();
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
  matchMinutes,
}: MatchTickerProps) {
  const matchMap = useMemo(
    () => buildMatchMap(brackets, nextMatch),
    [brackets, nextMatch],
  );

  const despMatch = desempate.match;

  const { previous, live, next } = useMemo(() => {
    const liveIds = liveMatchIds(schedule, matchMinutes);
    const despId = despMatch?.id ?? null;

    // --- Find the live match: first live id whose match is in the map AND PENDING ---
    let liveSlot: SlotInfo | null = null;
    for (const id of liveIds) {
      const m = matchMap.get(id);
      if (m && m.resultStatus === "PENDING") {
        const idx = schedule.findIndex((s) => s.id === id);
        if (idx !== -1) {
          liveSlot = { row: schedule[idx], kind: "known", match: m };
          break;
        }
      }
    }
    // Fallback: check if a live id is the desempate match
    if (!liveSlot) {
      for (const id of liveIds) {
        if (id === despId && despMatch) {
          const idx = schedule.findIndex((s) => s.id === id);
          if (idx !== -1) {
            liveSlot = { row: schedule[idx], kind: "desempate", despMatch };
            break;
          }
        }
      }
    }

    // --- Previous: last schedule entry before live slot with COMPLETE or WINNER_ONLY ---
    let previousSlot: SlotInfo | null = null;
    const searchStart = liveSlot ? schedule.findIndex((s) => s.id === liveSlot.row.id) : schedule.length;
    for (let i = searchStart - 1; i >= 0; i--) {
      const row = schedule[i];
      const m = matchMap.get(row.id);
      if (m && (m.resultStatus === "COMPLETE" || m.resultStatus === "WINNER_ONLY")) {
        previousSlot = { row, kind: "known", match: m };
        break;
      }
    }
    // If no live match, search entire schedule for last decided
    if (!previousSlot) {
      for (let i = schedule.length - 1; i >= 0; i--) {
        const row = schedule[i];
        const m = matchMap.get(row.id);
        if (m && (m.resultStatus === "COMPLETE" || m.resultStatus === "WINNER_ONLY")) {
          previousSlot = { row, kind: "known", match: m };
          break;
        }
      }
    }

    // --- Next: first schedule entry after live slot that is PENDING ---
    let nextSlot: SlotInfo | null = null;
    if (liveSlot) {
      const start = schedule.findIndex((s) => s.id === liveSlot.row.id) + 1;
      for (let i = start; i < schedule.length; i++) {
        const row = schedule[i];
        const m = matchMap.get(row.id);
        if (m && m.resultStatus === "PENDING") {
          nextSlot = { row, kind: "known", match: m };
          break;
        }
      }
    }
    // If no live match, find first PENDING in schedule
    if (!nextSlot) {
      for (let i = 0; i < schedule.length; i++) {
        const row = schedule[i];
        const m = matchMap.get(row.id);
        if (m && m.resultStatus === "PENDING") {
          nextSlot = { row, kind: "known", match: m };
          break;
        }
      }
    }

    return { previous: previousSlot, live: liveSlot, next: nextSlot };
  }, [schedule, matchMap, despMatch, matchMinutes]);

  return (
    <section aria-label="Marcador" className="rounded-2xl border border-sand-300 bg-white/70 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
      <h2 className="text-lg font-semibold text-stone-900">Marcador</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        {/* Live block */}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">En vivo</span>
          {live ? (
            <LiveMatchBlock
              slot={live}
              matchMap={matchMap}
              despMatch={despMatch}
            />
          ) : (
            <p className="text-sm text-stone-400">Sin partido en curso</p>
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

function LiveMatchBlock({
  slot,
  matchMap,
  despMatch,
}: {
  slot: SlotInfo;
  matchMap: Map<string, MatchPublic>;
  despMatch: DesempateMatchInfo | null;
}) {
  const isDesempate = slot.kind === "desempate";
  const desp = isDesempate ? slot.despMatch : null;
  const teams = isDesempate
    ? { teamA: desp?.teamA?.name ?? null, teamB: desp?.teamB?.name ?? null }
    : getTeams((slot as { kind: "known"; match: MatchPublic }).match.id, matchMap, despMatch);

  const result = isDesempate
    ? { status: "PENDING" as const, setA: null, setB: null, winnerName: null }
    : getResult(slot.match.id, matchMap, despMatch);

  const teamAName = teams.teamA ?? "—";
  const teamBName = teams.teamB ?? "—";
  const windowText = slot.row.estimated ?? slot.row.scheduled;

  const resultLine = (() => {
    if (!isDesempate && result.status === "COMPLETE") {
      return `${result.setA ?? "—"} - ${result.setB ?? "—"}`;
    }
    if (!isDesempate && result.status === "WINNER_ONLY" && result.winnerName) {
      return `Ganó ${result.winnerName}`;
    }
    if (!isDesempate && result.status === "WINNER_ONLY") {
      return "Ganó";
    }
    return "Jugando…";
  })();

  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-stone-900">
        <span className="text-stone-900">{teamAName}</span>
        {" vs "}
        <span className="text-stone-900">{teamBName}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
          EN VIVO
        </span>
        <span className="text-xs text-stone-600">{resultLine}</span>
      </div>
      {windowText && (
        <p className="text-[11px] text-stone-400">{windowText}</p>
      )}
    </div>
  );
}

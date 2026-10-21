"use client";

import { useMemo } from "react";
import { stageLabel } from "@/lib/front/phase";
import type { DesempateInfo, MatchPublic, ScheduleRow } from "@/lib/front/types";
import { setWins } from "@/lib/front/types";

interface MatchTickerProps {
  schedule: ScheduleRow[];
  brackets: MatchPublic[];
  nextMatch: MatchPublic | null;
  desempate: DesempateInfo;
  /**
   * Hay una etapa jugándose ahora. Fuera de eso el marcador no se muestra.
   */
  enCurso?: boolean;
}

/**
 * Build a lookup map of matchId -> MatchPublic. The public schedule carries
 * every match of the etapa (group stage included) with its teams and result, so
 * it is the primary source; the bracket payload refines the knockout stages.
 */
function buildMatchMap(
  schedule: ScheduleRow[],
  brackets: MatchPublic[],
  nextMatch: MatchPublic | null,
): Map<string, MatchPublic> {
  const map = new Map<string, MatchPublic>();
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

type Slot = { row: ScheduleRow; match: MatchPublic };

/** One team line: name on the left, sets won on the right. */
function TeamLine({
  name,
  score,
  winner,
}: {
  readonly name: string;
  readonly score: number | null;
  readonly winner: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span
        className={`min-w-0 truncate text-[16px] sm:text-[15px] ${
          winner ? "font-bold text-stone-900" : "font-medium text-stone-600"
        }`}
      >
        {name}
      </span>
      {score !== null && (
        <span
          className={`font-display text-xl leading-none tabular-nums ${
            winner ? "text-selva-800" : "text-stone-400"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function ScoreboardSide({
  label,
  slot,
}: {
  readonly label: string;
  readonly slot: Slot | null;
}) {
  const match = slot?.match ?? null;
  const wins = match?.resultStatus === "COMPLETE" ? setWins(match.sets) : null;
  const window = slot ? slot.row.estimated ?? slot.row.scheduled : null;

  // A decided match shows its sets; a winner-only one names who won; a pending
  // one shows the time it is due.
  const caption = (() => {
    if (!slot) return "Todavía no hay partido";
    if (wins) return stageLabel(match!.stage);
    if (match?.resultStatus === "WINNER_ONLY") {
      return match.winner?.name ? `Ganó ${match.winner.name}` : "Ganó";
    }
    return window ?? stageLabel(match!.stage);
  })();

  return (
    <div className="min-w-0 flex-1">
      <p className="text-[12px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      {slot ? (
        <>
          <div className="mt-1 divide-y divide-sand-200">
            <TeamLine
              name={match?.teamA?.name ?? "Equipo A"}
              score={wins ? wins.a : null}
              winner={!!match?.winnerId && match.winnerId === match.teamAId}
            />
            <TeamLine
              name={match?.teamB?.name ?? "Equipo B"}
              score={wins ? wins.b : null}
              winner={!!match?.winnerId && match.winnerId === match.teamBId}
            />
          </div>
          <p className="mt-1.5 text-[13px] sm:text-xs text-stone-500">{caption}</p>
        </>
      ) : (
        <p className="mt-2 text-[15px] sm:text-sm text-stone-400">
          {label === "Próximo" ? "No queda ningún partido" : "Sin resultados todavía"}
        </p>
      )}
    </div>
  );
}

export function MatchTicker({
  schedule,
  brackets,
  nextMatch,
  desempate,
  enCurso = true,
}: MatchTickerProps) {
  const matchMap = useMemo(
    () => buildMatchMap(schedule, brackets, nextMatch),
    [schedule, brackets, nextMatch],
  );

  const { previous, next } = useMemo(() => {
    // Anterior: el último partido del programa que ya tiene resultado.
    let previousSlot: Slot | null = null;
    for (let i = schedule.length - 1; i >= 0; i--) {
      const row = schedule[i];
      const m = matchMap.get(row.id);
      if (m && (m.resultStatus === "COMPLETE" || m.resultStatus === "WINNER_ONLY")) {
        previousSlot = { row, match: m };
        break;
      }
    }

    // Próximo: el primero que sigue pendiente.
    let nextSlot: Slot | null = null;
    for (let i = 0; i < schedule.length; i++) {
      const row = schedule[i];
      const m = matchMap.get(row.id);
      if (m && m.resultStatus === "PENDING") {
        nextSlot = { row, match: m };
        break;
      }
    }

    return { previous: previousSlot, next: nextSlot };
  }, [schedule, matchMap]);

  // The desempate is just another match in the schedule; nothing extra to show.
  void desempate;

  // El marcador solo existe mientras hay una etapa en juego: fuera de eso el
  // visitante no tiene nada que leer acá.
  if (!enCurso) return null;

  return (
    <section
      aria-label="Marcador"
      className="rounded-2xl border border-selva-200 bg-white/85 p-3 sm:p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
        <div className="min-w-0 flex-1 rounded-xl border border-selva-100 bg-selva-50 px-4 py-3">
          <ScoreboardSide label="Anterior" slot={previous} />
        </div>
        <div className="min-w-0 flex-1 rounded-xl border border-selva-100 bg-selva-50 px-4 py-3">
          <ScoreboardSide label="Próximo" slot={next} />
        </div>
      </div>
    </section>
  );
}

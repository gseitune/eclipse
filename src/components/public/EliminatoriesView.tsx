"use client";

import { useEffect, useMemo, useState } from "react";
import { liveMatchIds } from "@/lib/front/live";
import { stageLabel, phaseLabel, isKnownPhase } from "@/lib/front/phase";
import type { MatchPublic, ScheduleRow, EtapaPosition } from "@/lib/front/types";
import { setWins } from "@/lib/front/types";
import { fetchRanking } from "@/lib/front/api";
import { Podium } from "@/components/public/Podium";

interface EliminatoriesViewProps {
  brackets: MatchPublic[];
  phase: string;
  schedule: ScheduleRow[];
  matchMinutes: number;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}

export function EliminatoriesView({
  brackets,
  phase,
  schedule,
  matchMinutes,
  onOpenTeam,
}: EliminatoriesViewProps) {
  const liveIds = useMemo(
    () => liveMatchIds(schedule, matchMinutes),
    [schedule, matchMinutes],
  );

  // Podium data: only the last finished etapa
  const [lastFinishedPositions, setLastFinishedPositions] = useState<
    EtapaPosition[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    fetchRanking()
      .then((data) => {
        if (cancelled) return;
        const finished = [...data.etapas]
          .reverse()
          .find((e) => e.finished && e.positions.length > 0);
        setLastFinishedPositions(finished ? finished.positions : null);
      })
      .catch(() => {
        if (!cancelled) setLastFinishedPositions(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const semis = useMemo(
    () =>
      brackets.filter(
        (b) => b.stage === "SEMIFINAL_1" || b.stage === "SEMIFINAL_2",
      ),
    [brackets],
  );

  const semifinal1 = semis.find((b) => b.stage === "SEMIFINAL_1") ?? null;
  const semifinal2 = semis.find((b) => b.stage === "SEMIFINAL_2") ?? null;
  const finalMatch = brackets.find((b) => b.stage === "FINAL") ?? null;

  const isDesempate = phase === "DESEMPATE";

  // Champion from FINAL match
  const finalComplete =
    finalMatch &&
    (finalMatch.resultStatus === "COMPLETE" ||
      finalMatch.resultStatus === "WINNER_ONLY");

  function handleOpenTeam(
    match: MatchPublic,
    side: "A" | "B",
  ) {
    const player = side === "A" ? match.teamA : match.teamB;
    if (!player) return;
    onOpenTeam({ id: player.id, name: player.name, zone: "—" });
  }

  function matchResultLabel(m: MatchPublic) {
    switch (m.resultStatus) {
      case "COMPLETE": {
        const sw = setWins(m.sets);
        return `${sw.a} - ${sw.b}`;
      }
      case "WINNER_ONLY":
        return m.winner ? `Ganó ${m.winner.name}` : "Ganó";
      case "PENDING":
        return m.timeLabel ? `vs ${m.timeLabel}` : "vs";
      default:
        return "";
    }
  }

  function isLiveMatch(m: MatchPublic | null) {
    if (!m) return false;
    return liveIds.has(m.id);
  }

  // Unknown phase: render generic strip
  if (!isKnownPhase(phase)) {
    return (
      <section aria-label="Cuadro" className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
        <h2 className="text-lg font-semibold text-stone-900">Cuadro</h2>
        <p className="mt-2 text-sm text-stone-500">
          Estado del torneo: {phaseLabel(phase)}
        </p>
      </section>
    );
  }

  // DESEMPATE waiting state
  if (isDesempate) {
    return (
      <section aria-label="Cuadro" className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
        <h2 className="text-lg font-semibold text-stone-900">Cuadro</h2>
        <div className="mt-4 flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-700">
          <p>Cuadro disponible al finalizar el desempate</p>
        </div>
      </section>
    );
  }

  // Empty brackets edge case
  if (brackets.length === 0) {
    return (
      <section aria-label="Cuadro" className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
        <h2 className="text-lg font-semibold text-stone-900">Cuadro</h2>
        <p className="mt-2 text-sm text-stone-500">Generando cuadro…</p>
      </section>
    );
  }

  return (
    <section aria-label="Cuadro" className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
      <h2 className="text-lg font-semibold text-stone-900">Cuadro</h2>

      {/* Podium — last finished etapa, above the bracket */}
      {lastFinishedPositions && (
        <Podium positions={lastFinishedPositions} />
      )}

      {/* Semifinal cards — two side by side on sm+ */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[semifinal1, semifinal2].map((match) => {
          if (!match) {
            return (
              <div
                key="semi-slot"
                className="rounded-xl border border-sand-200 bg-white/40 p-4"
              >
                <p className="text-sm text-stone-400">—</p>
              </div>
            );
          }
          const live = isLiveMatch(match);
          const winner = match.winner;
          const isWinnerA =
            match.resultStatus === "COMPLETE" ||
            match.resultStatus === "WINNER_ONLY"
              ? match.winnerId === match.teamAId
              : false;
          const isWinnerB =
            match.resultStatus === "COMPLETE" ||
            match.resultStatus === "WINNER_ONLY"
              ? match.winnerId === match.teamBId
              : false;

          return (
            <div
              key={match.id}
              className={`rounded-xl border p-4 ${
                live
                  ? "ring-2 ring-ember-500 ring-inset animate-pulse"
                  : "border-sand-200 bg-white/40"
              } ${
                winner ? "ring-2 ring-amber-500 ring-inset" : ""
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                {stageLabel(match.stage)}
              </p>
              {live && (
                <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-ember-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
                  EN VIVO
                </span>
              )}
              <div className="mt-3 space-y-2">
                {/* Team A */}
                <button
                  onClick={() => handleOpenTeam(match, "A")}
                  className={`min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
                    isWinnerA
                      ? "bg-amber-50 text-amber-800 font-bold ring-2 ring-amber-400"
                      : "text-stone-800 hover:bg-sand-100"
                  }`}
                >
                  {match.teamA?.name ?? "—"}
                </button>
                {/* Team B */}
                <button
                  onClick={() => handleOpenTeam(match, "B")}
                  className={`min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
                    isWinnerB
                      ? "bg-amber-50 text-amber-800 font-bold ring-2 ring-amber-400"
                      : "text-stone-800 hover:bg-sand-100"
                  }`}
                >
                  {match.teamB?.name ?? "—"}
                </button>
                {/* Result */}
                <p className="text-center text-sm font-semibold text-stone-700">
                  {matchResultLabel(match)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* FINAL card — centered below, winner ascends */}
      {finalMatch && (
        <div className="mt-4 flex justify-center">
          <div
            className={`w-full max-w-xs rounded-xl border p-4 ${
              finalComplete
                ? "ring-2 ring-amber-500 ring-inset bg-amber-50/40"
                : "border-sand-200 bg-white/40"
            }`}
          >
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-stone-400">
              {stageLabel(finalMatch.stage)}
            </p>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => handleOpenTeam(finalMatch, "A")}
                className={`min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
                  finalMatch.winnerId === finalMatch.teamAId && finalComplete
                    ? "bg-amber-50 text-amber-800 font-bold ring-2 ring-amber-400"
                    : "text-stone-800 hover:bg-sand-100"
                }`}
              >
                {finalMatch.teamA?.name ?? "—"}
              </button>
              <button
                onClick={() => handleOpenTeam(finalMatch, "B")}
                className={`min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
                  finalMatch.winnerId === finalMatch.teamBId && finalComplete
                    ? "bg-amber-50 text-amber-800 font-bold ring-2 ring-amber-400"
                    : "text-stone-800 hover:bg-sand-100"
                }`}
              >
                {finalMatch.teamB?.name ?? "—"}
              </button>
              <p className="text-center text-sm font-semibold text-stone-700">
                {matchResultLabel(finalMatch)}
              </p>
            </div>
          </div>
        </div>
      )}
      </section>
    );
  }

"use client";

import { useEffect, useMemo, useState } from "react";
import { liveMatchIds } from "@/lib/front/live";
import { stageLabel, phaseLabel, isKnownPhase } from "@/lib/front/phase";
import type { MatchPublic, ScheduleRow, EtapaPosition } from "@/lib/front/types";
import { fetchRanking } from "@/lib/front/api";
import { Podium } from "@/components/public/Podium";

interface EliminatoriesViewProps {
  brackets: MatchPublic[];
  phase: string;
  schedule: ScheduleRow[];
  matchMinutes: number;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}

function TeamButton({
  match,
  side,
  onOpenTeam,
  showWinner,
}: {
  match: MatchPublic;
  side: "A" | "B";
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
  showWinner: boolean;
}) {
  const player = side === "A" ? match.teamA : match.teamB;
  const teamId = side === "A" ? match.teamAId : match.teamBId;
  const isWinner =
    showWinner &&
    (match.resultStatus === "COMPLETE" ||
      match.resultStatus === "WINNER_ONLY") &&
    match.winnerId === teamId;

  return (
    <button
      onClick={() => {
        if (!player) return;
        onOpenTeam({ id: player.id, name: player.name, zone: "—" });
      }}
      className={`flex min-h-[26px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-0.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
        isWinner
          ? "bg-green-200/60 text-black font-bold ring-1 ring-inset ring-green-800/30"
          : "text-black hover:bg-sand-100"
      }`}
    >
      <span className="truncate">{player?.name ?? "—"}</span>
      {isWinner && (
        <span className="shrink-0 rounded bg-green-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Ganador
        </span>
      )}
    </button>
  );
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
        <div className="mt-4 flex items-center justify-center rounded-xl border border-amber-soft-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-700">
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

      {/* FINAL card — centered below the podium, above the semifinals */}
      {finalMatch && (
        <div className="mt-4 flex justify-center">
          <div
            className={`w-full max-w-[220px] rounded-xl border p-3 ${
              finalComplete
                ? "ring-2 ring-amber-soft-500 ring-inset bg-amber-50/40"
                : "border-sand-200 bg-white/40"
            }`}
          >
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-black">
              {stageLabel(finalMatch.stage)}
            </p>
            <div className="mt-2 space-y-1.5">
              <TeamButton
                match={finalMatch}
                side="A"
                onOpenTeam={() => handleOpenTeam(finalMatch, "A")}
                showWinner={finalComplete === true}
              />
              <TeamButton
                match={finalMatch}
                side="B"
                onOpenTeam={() => handleOpenTeam(finalMatch, "B")}
                showWinner={finalComplete === true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Semifinal cards — two side by side on sm+, narrower than full width */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mx-auto sm:max-w-[600px] sm:grid-cols-2">
        {[semifinal1, semifinal2].map((match) => {
          if (!match) {
            return (
              <div
                key="semi-slot"
                className="rounded-xl border border-sand-200 bg-white/40 p-4"
              >
                <p className="text-sm text-black">—</p>
              </div>
            );
          }
          const live = isLiveMatch(match);
          const winner = match.winner;

          return (
            <div
              key={match.id}
              className={`rounded-xl border p-1.5 ${
                live
                  ? "ring-2 ring-ember-500 ring-inset animate-pulse"
                  : "border-sand-200 bg-white/40"
              } ${
                winner ? "ring-2 ring-amber-soft-500 ring-inset" : ""
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-black">
                {stageLabel(match.stage)}
              </p>
              {live && (
                <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-ember-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
                  EN VIVO
                </span>
              )}
              <div className="mt-1 space-y-1">
                <TeamButton
                  match={match}
                  side="A"
                  onOpenTeam={() => handleOpenTeam(match, "A")}
                  showWinner={!!winner}
                />
                <TeamButton
                  match={match}
                  side="B"
                  onOpenTeam={() => handleOpenTeam(match, "B")}
                  showWinner={!!winner}
                />
              </div>
            </div>
          );
        })}
      </div>
      </section>
    );
  }

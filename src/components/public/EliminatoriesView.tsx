"use client";

import { useMemo } from "react";
import { liveMatchIds } from "@/lib/front/live";
import { phaseLabel, isKnownPhase } from "@/lib/front/phase";
import { groupBracketColumns, matchScore } from "@/lib/front/bracket";
import type { MatchPublic, ScheduleRow } from "@/lib/front/types";

interface EliminatoriesViewProps {
  brackets: MatchPublic[];
  phase: string;
  schedule: ScheduleRow[];
  matchMinutes: number;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}

/**
 * Knockout panel, rendered as bare content inside the TournamentTabs card.
 *
 * Left-to-right bracket: earliest round on the left, final on the right, with
 * the third-place match under the final. Matches are separated by hairlines
 * instead of boxes, and the layout always fits the card — on phones the rounds
 * stack, so nothing ever scrolls sideways.
 */
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

  if (!isKnownPhase(phase)) {
    return (
      <p className="text-sm text-stone-500">
        Estado del torneo: {phaseLabel(phase)}
      </p>
    );
  }

  if (phase === "DESEMPATE") {
    return (
      <div className="flex items-center justify-center rounded-xl border border-amber-soft-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-700">
        <p>Cuadro disponible al finalizar el desempate</p>
      </div>
    );
  }

  if (brackets.length === 0) {
    return <p className="text-sm text-stone-500">Generando cuadro…</p>;
  }

  const columns = groupBracketColumns(brackets);

  return (
    <>
      {/* Phones: rounds stack top to bottom, no sideways scrolling */}
      <div className="space-y-4 sm:hidden">
        {columns.map((column) => (
          <div key={column.key} className="space-y-3">
            {column.groups.map((group) => (
              <BracketGroup
                key={group.label}
                group={group}
                liveIds={liveIds}
                onOpenTeam={onOpenTeam}
              />
            ))}
          </div>
        ))}
      </div>

      {/* sm and up: left-to-right bracket, always inside the card */}
      <div className="hidden gap-3 sm:flex">
        {columns.map((column) => (
          <div
            key={column.key}
            className="flex min-w-0 flex-1 flex-col justify-center gap-3 border-l border-sand-300/70 pl-3 first:border-l-0 first:pl-0"
          >
            {column.groups.map((group) => (
              <BracketGroup
                key={group.label}
                group={group}
                liveIds={liveIds}
                onOpenTeam={onOpenTeam}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function BracketGroup({
  group,
  liveIds,
  onOpenTeam,
}: {
  group: { label: string; matches: MatchPublic[] };
  liveIds: Set<string>;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}) {
  return (
    <div>
      <p className="mb-1 truncate border-b border-sand-300/70 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        {group.label}
      </p>
      <div className="divide-y divide-sand-300/50">
        {group.matches.map((match) => (
          <MatchBlock
            key={match.id}
            match={match}
            live={liveIds.has(match.id)}
            onOpenTeam={onOpenTeam}
          />
        ))}
      </div>
    </div>
  );
}

function MatchBlock({
  match,
  live,
  onOpenTeam,
}: {
  match: MatchPublic;
  live: boolean;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}) {
  return (
    <div className={`py-1 ${live ? "bg-ember-50/40" : ""}`}>
      <div className="divide-y divide-sand-300/50">
        <TeamLine match={match} side="A" onOpenTeam={onOpenTeam} />
        <TeamLine match={match} side="B" onOpenTeam={onOpenTeam} />
      </div>
    </div>
  );
}

function TeamLine({
  match,
  side,
  onOpenTeam,
}: {
  match: MatchPublic;
  side: "A" | "B";
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}) {
  const player = side === "A" ? match.teamA : match.teamB;
  const teamId = side === "A" ? match.teamAId : match.teamBId;

  const decided =
    match.resultStatus === "COMPLETE" || match.resultStatus === "WINNER_ONLY";
  const isWinner = decided && match.winnerId !== null && match.winnerId === teamId;

  // Single set -> points of that set; final (best of three) -> sets won;
  // winner only -> no number at all.
  const score = matchScore(match);
  const value = score ? (side === "A" ? score.a : score.b) : null;

  return (
    <button
      onClick={() => {
        if (!player) return;
        onOpenTeam({ id: player.id, name: player.name, zone: "—" });
      }}
      className={`flex w-full items-center justify-between gap-1.5 rounded px-1 py-1 text-left text-[11px] leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
        isWinner
          ? "bg-emerald-50 font-semibold text-emerald-900"
          : player
            ? "text-stone-700 hover:bg-sand-100"
            : "text-stone-300"
      }`}
    >
      <span className="truncate">{player?.name ?? "—"}</span>
      {value !== null && (
        <span
          className={`shrink-0 tabular-nums ${isWinner ? "text-emerald-800" : "text-stone-400"}`}
        >
          {value}
        </span>
      )}
    </button>
  );
}

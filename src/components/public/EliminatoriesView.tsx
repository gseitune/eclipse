"use client";

import { useMemo, type ReactNode } from "react";

import { buildBracketColumns, matchScore, type BracketSlot } from "@/lib/front/bracket";
import { liveMatchIds } from "@/lib/front/live";
import { isKnownPhase, phaseLabel } from "@/lib/front/phase";
import type { MatchPlayer, MatchPublic, ScheduleRow, Stage } from "@/lib/front/types";

interface EliminatoriesViewProps {
  brackets: MatchPublic[];
  phase: string;
  schedule: ScheduleRow[];
  matchMinutes: number;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
}

type OpenTeam = (team: { id: string; name: string; zone: string }) => void;

/**
 * Fixed column layout per format (spec S9 / E6). The boxes are always in the
 * same place so the bracket reads the same on every phone, and the whole board
 * fits the screen width without horizontal scrolling:
 *
 *   left   -> repechaje on top of the cuartos boxes
 *   middle -> semifinals
 *   right  -> final, with the 3rd/4th place match below it
 */
const STAGE_LABEL: Partial<Record<Stage, string>> = {
  REPECHAJE_1: "Repechaje",
  REPECHAJE_2: "Repechaje",
  CUARTOS_1: "Cuartos",
  CUARTOS_2: "Cuartos",
  CUARTOS_3: "Cuartos",
  CUARTOS_4: "Cuartos",
  SEMIFINAL_1: "Semifinal",
  SEMIFINAL_2: "Semifinal",
  BRONZE: "3er y 4to",
  FINAL: "Final",
};

function NoticeBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-6 text-center text-sm text-stone-500">
      {children}
    </div>
  );
}

interface MatchRow {
  key: "a" | "b";
  player: MatchPlayer | null;
  score: number | null;
  winner: boolean;
}

function matchRows(match: MatchPublic | null): MatchRow[] {
  const score = match ? matchScore(match) : null;
  const teamA = match?.teamA ?? null;
  const teamB = match?.teamB ?? null;

  return [
    {
      key: "a",
      player: teamA,
      score: score ? score.a : null,
      winner: Boolean(match && teamA && match.winnerId === match.teamAId),
    },
    {
      key: "b",
      player: teamB,
      score: score ? score.b : null,
      winner: Boolean(match && teamB && match.winnerId === match.teamBId),
    },
  ];
}

function MatchBox({
  match,
  live,
  emphasis,
  onOpenTeam,
}: {
  match: MatchPublic | null;
  live: boolean;
  emphasis: boolean;
  onOpenTeam: OpenTeam;
}) {
  const zone = match?.zone ?? "";
  let border = "border-sand-300";
  if (emphasis) border = "border-sun-500";
  if (live) border = "border-ember-500 ring-2 ring-ember-500/30";

  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm ${border}`}>
      {matchRows(match).map((row) => (
        <button
          key={row.key}
          type="button"
          disabled={!row.player}
          onClick={() => {
            if (!row.player) return;
            onOpenTeam({ id: row.player.id, name: row.player.name, zone });
          }}
          className={`flex w-full items-start justify-between gap-1 border-b border-sand-100 px-1.5 py-1.5 text-left text-[0.72rem] leading-tight transition-colors last:border-b-0 ${
            row.player ? "hover:bg-sand-50" : "cursor-default"
          } ${row.winner ? "bg-amber-soft-100 font-semibold text-foreground" : "text-stone-600"}`}
        >
          <span className={`min-w-0 flex-1 break-words ${row.player ? "" : "italic text-stone-400"}`}>
            {row.player ? row.player.name : "A definir"}
          </span>
          <span className="shrink-0 tabular-nums text-stone-500">{row.score ?? ""}</span>
        </button>
      ))}
    </div>
  );
}

const COLUMN_JUSTIFY = {
  start: "justify-start",
  around: "justify-around",
  center: "justify-center",
} as const;

function BracketColumn({
  slots,
  justify,
  liveIds,
  onOpenTeam,
}: {
  slots: BracketSlot[];
  justify: keyof typeof COLUMN_JUSTIFY;
  liveIds: Set<string>;
  onOpenTeam: OpenTeam;
}) {
  if (slots.length === 0) return null;

  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${COLUMN_JUSTIFY[justify]}`}>
      {slots.map((slot) => (
        <div key={slot.stage} className="flex flex-col gap-0.5">
          <span className="px-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-stone-400">
            {STAGE_LABEL[slot.stage] ?? slot.stage}
          </span>
          <MatchBox
            match={slot.match}
            live={Boolean(slot.match && liveIds.has(slot.match.id))}
            emphasis={slot.stage === "FINAL"}
            onOpenTeam={onOpenTeam}
          />
        </div>
      ))}
    </div>
  );
}

export function EliminatoriesView({
  brackets,
  phase,
  schedule,
  matchMinutes,
  onOpenTeam,
}: EliminatoriesViewProps) {
  const liveIds = useMemo(() => liveMatchIds(schedule, matchMinutes), [schedule, matchMinutes]);
  const columns = useMemo(() => buildBracketColumns(brackets), [brackets]);

  if (!isKnownPhase(phase)) {
    return <NoticeBox>Estado del torneo: {phaseLabel(phase)}</NoticeBox>;
  }

  if (phase === "DESEMPATE") {
    return <NoticeBox>Cuadro disponible al finalizar el desempate</NoticeBox>;
  }

  if (brackets.length === 0) {
    return <NoticeBox>Generando cuadro…</NoticeBox>;
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-stretch gap-1.5">
        <BracketColumn slots={columns.left} justify="start" liveIds={liveIds} onOpenTeam={onOpenTeam} />
        <BracketColumn slots={columns.middle} justify="around" liveIds={liveIds} onOpenTeam={onOpenTeam} />
        <BracketColumn slots={columns.right} justify="center" liveIds={liveIds} onOpenTeam={onOpenTeam} />
      </div>
    </div>
  );
}

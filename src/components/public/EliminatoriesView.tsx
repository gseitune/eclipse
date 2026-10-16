"use client";

import { Fragment, useMemo, type ReactNode } from "react";

import {
  buildBracketColumns,
  matchScore,
  type BracketColumns,
  type BracketSlot,
} from "@/lib/front/bracket";
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

type BoxSize = "tiny" | "compact" | "regular";

/**
 * Every box is compact, except the final. The repechaje is one step smaller
 * again, because it is a single play-in game.
 */
const BOX_SIZE_CLASS: Record<BoxSize, string> = {
  tiny: "px-1 py-0 text-[0.55rem]",
  compact: "px-1.5 py-0.5 text-[0.62rem]",
  regular: "px-1.5 py-1.5 text-[0.72rem]",
};

function slotSize(stage: Stage): BoxSize {
  if (stage === "FINAL") return "regular";
  if (stage === "REPECHAJE_1" || stage === "REPECHAJE_2") return "tiny";
  return "compact";
}

function MatchBox({
  match,
  live,
  emphasis,
  size,
  onOpenTeam,
}: {
  match: MatchPublic | null;
  live: boolean;
  emphasis: boolean;
  size: BoxSize;
  onOpenTeam: OpenTeam;
}) {
  const zone = match?.zone ?? "";
  let border = "border-sand-300";
  if (emphasis) border = "border-sun-500";
  if (live) border = "border-ember-500 ring-2 ring-ember-500/30";
  const sizing = BOX_SIZE_CLASS[size];

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
          className={`flex w-full items-start justify-between gap-1 border-b border-sand-100 text-left leading-tight transition-colors last:border-b-0 ${sizing} ${
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

function SlotView({
  slot,
  liveIds,
  onOpenTeam,
}: {
  slot: BracketSlot;
  liveIds: Set<string>;
  onOpenTeam: OpenTeam;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="px-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-stone-400">
        {STAGE_LABEL[slot.stage] ?? slot.stage}
      </span>
      <MatchBox
        match={slot.match}
        live={Boolean(slot.match && liveIds.has(slot.match.id))}
        emphasis={slot.stage === "FINAL"}
        size={slotSize(slot.stage)}
        onOpenTeam={onOpenTeam}
      />
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
        <SlotView key={slot.stage} slot={slot} liveIds={liveIds} onOpenTeam={onOpenTeam} />
      ))}
    </div>
  );
}

/**
 * Cuartos format. The left column lists the repechaje and then the cuartos
 * already paired for the semis (QF1, QF4, QF2, QF3), so each semi can be
 * centered between the two cuartos that feed it. A grid keeps every box in the
 * same place whatever the length of the team names.
 */
function CuartosBoard({
  columns,
  liveIds,
  onOpenTeam,
}: {
  columns: BracketColumns;
  liveIds: Set<string>;
  onOpenTeam: OpenTeam;
}) {
  const cuartos = columns.left.slice(1);
  const pairs: Array<[BracketSlot, BracketSlot]> = [];
  for (let index = 0; index + 1 < cuartos.length; index += 2) {
    const top = cuartos[index];
    const bottom = cuartos[index + 1];
    if (top && bottom) pairs.push([top, bottom]);
  }
  const repechaje = columns.left[0] ?? null;
  const rows = pairs.length * 2 + 1;

  return (
    <div
      className="grid gap-x-1.5 gap-y-1.5"
      style={{
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gridTemplateRows: `repeat(${rows}, auto)`,
      }}
    >
      {repechaje ? (
        <div style={{ gridColumn: 1, gridRow: 1 }}>
          <SlotView slot={repechaje} liveIds={liveIds} onOpenTeam={onOpenTeam} />
        </div>
      ) : null}

      {pairs.map((pair, index) => {
        const [top, bottom] = pair;
        const semi = columns.middle[index] ?? null;
        const firstRow = index * 2 + 2;

        return (
          <Fragment key={top.stage}>
            <div style={{ gridColumn: 1, gridRow: firstRow }}>
              <SlotView slot={top} liveIds={liveIds} onOpenTeam={onOpenTeam} />
            </div>
            <div style={{ gridColumn: 1, gridRow: firstRow + 1 }}>
              <SlotView slot={bottom} liveIds={liveIds} onOpenTeam={onOpenTeam} />
            </div>
            {semi ? (
              <div style={{ gridColumn: 2, gridRow: `${firstRow} / span 2`, alignSelf: "center" }}>
                <SlotView slot={semi} liveIds={liveIds} onOpenTeam={onOpenTeam} />
              </div>
            ) : null}
          </Fragment>
        );
      })}

      {/* Centered between the two semis, not on the whole board: the repechaje
          row on top must not push the final down. */}
      <div
        className="flex min-w-0 flex-col justify-center gap-2"
        style={{ gridColumn: 3, gridRow: `2 / span ${rows - 1}` }}
      >
        {columns.right.map((slot) => (
          <SlotView key={slot.stage} slot={slot} liveIds={liveIds} onOpenTeam={onOpenTeam} />
        ))}
      </div>
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

  if (columns.mode === "cuartos") {
    return (
      <div className="mx-auto w-full max-w-xl">
        <CuartosBoard columns={columns} liveIds={liveIds} onOpenTeam={onOpenTeam} />
      </div>
    );
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

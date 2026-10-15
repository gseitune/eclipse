"use client";

import { useMemo, type ReactNode } from "react";

import { buildBracketTree, matchScore, type BracketTreeNode } from "@/lib/front/bracket";
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

/** Round name shown above each box. */
const STAGE_LABEL: Partial<Record<Stage, string>> = {
  REPECHAJE_1: "Repechaje",
  REPECHAJE_2: "Repechaje",
  CUARTOS_1: "Cuartos",
  CUARTOS_2: "Cuartos",
  CUARTOS_3: "Cuartos",
  CUARTOS_4: "Cuartos",
  SEMIFINAL_1: "Semifinal",
  SEMIFINAL_2: "Semifinal",
  BRONZE: "3er y 4to puesto",
  FINAL: "Final",
};

function NoticeBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-amber-soft-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-700">
      {children}
    </div>
  );
}

function BracketSlot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function TeamRow({
  player,
  score,
  winner,
  zone,
  onOpenTeam,
}: {
  player: MatchPlayer | null;
  score: number | null;
  winner: boolean;
  zone: string;
  onOpenTeam: OpenTeam;
}) {
  const shell =
    "flex w-full items-center justify-between gap-2 border-b border-sand-100 px-2.5 py-1.5 text-left text-xs last:border-b-0";

  if (!player) {
    return (
      <div className={`${shell} text-stone-400`}>
        <span className="truncate italic">A definir</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenTeam({ id: player.id, name: player.name, zone })}
      className={`${shell} transition-colors hover:bg-sand-50 ${
        winner ? "bg-sand-50 font-semibold text-foreground" : "text-stone-600"
      }`}
    >
      <span className="truncate">{player.name}</span>
      <span className="shrink-0 tabular-nums">{score ?? ""}</span>
    </button>
  );
}

function MatchBox({
  match,
  live,
  emphasis = false,
  onOpenTeam,
}: {
  match: MatchPublic | null;
  live: boolean;
  emphasis?: boolean;
  onOpenTeam: OpenTeam;
}) {
  const score = match ? matchScore(match) : null;
  const zone = match?.zone ?? "";
  const rows: Array<{
    key: string;
    player: MatchPlayer | null;
    score: number | null;
    winner: boolean;
  }> = [
    {
      key: "A",
      player: match?.teamA ?? null,
      score: score?.a ?? null,
      winner: match?.winnerId != null && match.winnerId === match.teamAId,
    },
    {
      key: "B",
      player: match?.teamB ?? null,
      score: score?.b ?? null,
      winner: match?.winnerId != null && match.winnerId === match.teamBId,
    },
  ];
  const border = live
    ? "border-ember-500 ring-1 ring-ember-500/40"
    : emphasis
      ? "border-sun-500"
      : "border-sand-300";

  return (
    <div className={`w-44 shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm ${border}`}>
      {rows.map((row) => (
        <TeamRow
          key={row.key}
          player={row.player}
          score={row.score}
          winner={row.winner}
          zone={zone}
          onOpenTeam={onOpenTeam}
        />
      ))}
    </div>
  );
}

/**
 * One side of the tree: its box sits on the edge closest to the FINAL and each
 * previous round hangs to the outside, so both sides mirror each other.
 */
function TreeNode({
  node,
  mirror,
  liveIds,
  onOpenTeam,
}: {
  node: BracketTreeNode;
  mirror: boolean;
  liveIds: Set<string>;
  onOpenTeam: OpenTeam;
}) {
  const kids = [node.a, node.b].filter((kid): kid is BracketTreeNode => kid !== null);
  const slot = (
    <BracketSlot label={STAGE_LABEL[node.stage] ?? node.stage}>
      <MatchBox
        match={node.match}
        live={node.match ? liveIds.has(node.match.id) : false}
        onOpenTeam={onOpenTeam}
      />
    </BracketSlot>
  );

  if (kids.length === 0) return slot;

  return (
    <div className={`flex items-stretch ${mirror ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex flex-col justify-around gap-4 ${
          mirror ? "border-l border-sand-300 pl-4" : "border-r border-sand-300 pr-4"
        }`}
      >
        {kids.map((kid) => (
          <TreeNode key={kid.stage} node={kid} mirror={mirror} liveIds={liveIds} onOpenTeam={onOpenTeam} />
        ))}
      </div>
      <div className={`flex items-center ${mirror ? "flex-row-reverse" : ""}`}>
        <div className="h-px w-5 bg-sand-300" />
        {slot}
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
  const tree = useMemo(() => buildBracketTree(brackets), [brackets]);

  if (!isKnownPhase(phase)) {
    return (
      <NoticeBox>
        <p>Estado del torneo: {phaseLabel(phase)}</p>
      </NoticeBox>
    );
  }

  if (phase === "DESEMPATE") {
    return (
      <NoticeBox>
        <p>Cuadro disponible al finalizar el desempate</p>
      </NoticeBox>
    );
  }

  if (brackets.length === 0) {
    return (
      <NoticeBox>
        <p>Generando cuadro…</p>
      </NoticeBox>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch justify-center gap-6 px-1">
        <TreeNode node={tree.left} mirror={false} liveIds={liveIds} onOpenTeam={onOpenTeam} />
        <div className="flex flex-col items-center justify-center gap-8">
          <BracketSlot label={STAGE_LABEL.FINAL ?? "Final"}>
            <MatchBox
              match={tree.final}
              emphasis
              live={tree.final ? liveIds.has(tree.final.id) : false}
              onOpenTeam={onOpenTeam}
            />
          </BracketSlot>
          {tree.bronze ? (
            <BracketSlot label={STAGE_LABEL.BRONZE ?? "Bronce"}>
              <MatchBox
                match={tree.bronze}
                live={liveIds.has(tree.bronze.id)}
                onOpenTeam={onOpenTeam}
              />
            </BracketSlot>
          ) : null}
        </div>
        <TreeNode node={tree.right} mirror liveIds={liveIds} onOpenTeam={onOpenTeam} />
      </div>
    </div>
  );
}

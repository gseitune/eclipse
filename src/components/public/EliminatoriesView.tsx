"use client";

import { useMemo, type ReactNode } from "react";

import {
  buildBracketColumns,
  matchScore,
  type BracketSlot,
} from "@/lib/front/bracket";
import { isKnownPhase, phaseLabel } from "@/lib/front/phase";
import type { MatchPlayer, MatchPublic, Stage } from "@/lib/front/types";

interface EliminatoriesViewProps {
  brackets: MatchPublic[];
  phase: string;
  /**
   * Live match ids, already resolved by the page with the etapa guard
   * (`liveMatchIdsForEtapa`): a closed fecha never reports a match as live,
   * even when the clock still falls inside its window on a later day.
   */
  liveIds: Set<string>;
}


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
    <div className="rounded-xl border border-selva-200 bg-selva-50 px-4 py-6 text-center text-[15px] sm:text-sm text-stone-500">
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

const BOX_SIZE_CLASS: Record<BoxSize, string> = {
  tiny: "px-1.5 py-1 text-[0.76rem] sm:text-[0.66rem]",
  compact: "px-2 py-1.5 text-[0.82rem] sm:text-[0.72rem]",
  regular: "px-2.5 py-2 text-[0.9rem] sm:text-[0.8rem]",
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
}: {
  match: MatchPublic | null;
  live: boolean;
  emphasis: boolean;
  size: BoxSize;
}) {
  const zone = match?.zone ?? "";
  let border = "border-stone-300";
  if (emphasis) border = "border-selva-800 ring-2 ring-selva-800/20";
  if (live) border = "border-ember-500 ring-1 ring-ember-500/30";
  const sizing = BOX_SIZE_CLASS[size];
  void zone;

  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-sm border bg-white ${border}`}>
      {/* Live indicator: visual only (the public page has no audio). */}
      {live && (
        <div className="flex items-center gap-1 bg-ember-50 px-1.5 py-0.5 text-[0.7rem] sm:text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-ember-600">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500"
          />
          En vivo
        </div>
      )}
      {matchRows(match).map((row) => (
        <div
          key={row.key}
          className={`flex w-full items-start justify-between gap-1.5 border-b border-sand-200/70 leading-tight last:border-b-0 ${sizing} ${
            row.winner ? "border-l-2 border-l-selva-700" : ""
          } ${row.winner ? "font-bold text-stone-900" : "text-stone-600"}`}
        >
          <span className={`min-w-0 flex-1 break-words ${row.player ? "" : "italic text-stone-400"}`}>
            {row.player ? row.player.name : "A definir"}
          </span>
          <span className="shrink-0 tabular-nums text-stone-600">{row.score ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function SlotView({
  slot,
  liveIds,
  showLabel = false,
}: {
  slot: BracketSlot;
  liveIds: Set<string>;
  showLabel?: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      {showLabel && (
        <span className="px-0.5 text-[0.76rem] sm:text-[0.66rem] font-semibold text-stone-500">
          {STAGE_LABEL[slot.stage] ?? slot.stage}
        </span>
      )}
      <MatchBox
        match={slot.match}
        live={Boolean(slot.match && liveIds.has(slot.match.id))}
        emphasis={slot.stage === "FINAL"}
        size={slotSize(slot.stage)}
       
      />
    </div>
  );
}

/**
 * Línea de llave. El tramo vertical une los dos partidos que alimentan al
 * siguiente; el horizontal entra en el partido destino por su centro.
 */
const CONNECTOR = "relative shrink-0 self-stretch w-2 sm:w-5";

function PairConnector() {
  return (
    <div className={CONNECTOR} aria-hidden="true">
      <span className="absolute left-0 right-1/2 top-1/4 border-t border-stone-300" />
      <span className="absolute left-0 right-1/2 bottom-1/4 border-t border-stone-300" />
      <span className="absolute left-1/2 top-1/4 bottom-1/4 border-l border-stone-300" />
      <span className="absolute left-1/2 right-0 top-1/2 border-t border-stone-300" />
    </div>
  );
}

/** Línea recta para un partido que alimenta directo al siguiente. */
function StraightConnector() {
  return (
    <div className={CONNECTOR} aria-hidden="true">
      <span className="absolute left-0 right-0 top-1/2 border-t border-stone-300" />
    </div>
  );
}

/**
 * Une cuatro partidos con dos: los pares se juntan en 1/4 y 3/4 de la altura,
 * que es donde caen las dos filas de la ronda siguiente.
 */
function QuadConnector() {
  return (
    <div className={CONNECTOR} aria-hidden="true">
      <span className="absolute left-0 right-1/2 top-[12.5%] border-t border-stone-300" />
      <span className="absolute left-0 right-1/2 top-[37.5%] border-t border-stone-300" />
      <span className="absolute left-1/2 top-[12.5%] h-[25%] border-l border-stone-300" />
      <span className="absolute left-1/2 right-0 top-1/2 border-t border-stone-300" />

      <span className="absolute left-0 right-1/2 top-[62.5%] border-t border-stone-300" />
      <span className="absolute left-0 right-1/2 top-[87.5%] border-t border-stone-300" />
      <span className="absolute left-1/2 top-[62.5%] h-[25%] border-l border-stone-300" />
      <span className="absolute left-1/2 right-0 top-3/4 border-t border-stone-300" />
    </div>
  );
}

function Board({
  semis,
  final,
  bronze,
  liveIds,
}: {
  semis: ReactNode;
  final: BracketSlot;
  bronze: BracketSlot | null;
  liveIds: Set<string>;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-around gap-3">
          {semis}
        </div>
        <PairConnector />
        <div className="flex min-w-0 flex-1 items-center">
          <SlotView slot={final} liveIds={liveIds} showLabel />
        </div>
      </div>
      {/* El bronce va en su propia fila, alineado con la columna de la final:
          así mide lo mismo y no le mueve el centro a la llave. */}
      {bronze && (
        <div className="mt-3 flex items-stretch">
          <div className="min-w-0 flex-1" />
          <div className="w-2 shrink-0 sm:w-5" />
          <div className="min-w-0 flex-1">
            <SlotView slot={bronze} liveIds={liveIds} showLabel />
          </div>
        </div>
      )}
    </div>
  );
}

export function EliminatoriesView({
  brackets,
  phase,
  liveIds,
}: EliminatoriesViewProps) {
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

  const [semi1, semi2] = columns.middle;
  const final = columns.right.find((s) => s.stage === "FINAL") ?? null;
  const bronze = columns.right.find((s) => s.stage === "BRONZE") ?? null;
  const byStage = (stage: Stage) => columns.left.find((s) => s.stage === stage) ?? null;

  if (!semi1 || !semi2 || !final) {
    return <NoticeBox>Generando cuadro…</NoticeBox>;
  }

  // Cuartos: cada semi se dibuja entre los dos cuartos que la alimentan
  // (SF1 <- QF1, QF4 ; SF2 <- QF2, QF3). El repechaje entra a QF1, así que va
  // arriba con su propia línea.
  if (columns.mode === "cuartos") {
    const qf1 = byStage("CUARTOS_1");
    const qf4 = byStage("CUARTOS_4");
    const qf2 = byStage("CUARTOS_2");
    const qf3 = byStage("CUARTOS_3");
    const repe = byStage("REPECHAJE_1");

    if (!qf1 || !qf2 || !qf3 || !qf4) {
      return <NoticeBox>Generando cuadro…</NoticeBox>;
    }

    return (
      <div className="mx-auto w-full max-w-xl">
        {repe && (
          <div className="mb-2 flex items-center gap-1.5">
            <div className="w-[30%] min-w-0">
              <SlotView slot={repe} liveIds={liveIds} showLabel />
            </div>
            <StraightConnector />
            <span className="text-[0.72rem] sm:text-[0.62rem] text-stone-500">
              entra a Cuartos 1
            </span>
          </div>
        )}

        {/* Tres columnas parejas: cuartos, semis y final. Así cada caja usa el
            mismo ancho en el celular en vez de partirse en dos mitades. */}
        <div className="flex items-stretch">
          <div className="grid min-w-0 flex-1 grid-rows-4 gap-2">
            {[qf1, qf4, qf2, qf3].map((slot) => (
              <div key={slot.stage} className="flex items-center">
                <SlotView slot={slot} liveIds={liveIds} showLabel />
              </div>
            ))}
          </div>
          <QuadConnector />
          <div className="grid min-w-0 flex-1 grid-rows-2 gap-2">
            {[semi1, semi2].map((slot) => (
              <div key={slot.stage} className="flex items-center">
                <SlotView slot={slot} liveIds={liveIds} showLabel />
              </div>
            ))}
          </div>
          <PairConnector />
          <div className="flex min-w-0 flex-1 items-center">
            <SlotView slot={final} liveIds={liveIds} showLabel />
          </div>
        </div>

        {bronze && (
          <div className="mt-3 flex items-stretch">
            <div className="min-w-0 flex-1" />
            <div className="w-2 shrink-0 sm:w-5" />
            <div className="min-w-0 flex-1" />
            <div className="w-2 shrink-0 sm:w-5" />
            <div className="min-w-0 flex-1">
              <SlotView slot={bronze} liveIds={liveIds} showLabel />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Repechaje: cada repechaje alimenta a la semi del otro lado (SF1 <- RE2,
  // SF2 <- RE1), así que van en filas para que la línea no cruce.
  if (columns.mode === "repechaje") {
    const re1 = byStage("REPECHAJE_1");
    const re2 = byStage("REPECHAJE_2");

    return (
      <Board
        liveIds={liveIds}
        final={final}
        bronze={bronze}
       
        semis={
          <>
            <div className="flex items-stretch">
              <div className="w-[38%] min-w-0 self-center">
                {re2 ? (
                  <SlotView slot={re2} liveIds={liveIds} showLabel />
                ) : (
                  <span />
                )}
              </div>
              <StraightConnector />
              <div className="min-w-0 flex-1">
                <SlotView slot={semi1} liveIds={liveIds} showLabel />
              </div>
            </div>
            <div className="flex items-stretch">
              <div className="w-[38%] min-w-0 self-center">
                {re1 ? (
                  <SlotView slot={re1} liveIds={liveIds} showLabel />
                ) : (
                  <span />
                )}
              </div>
              <StraightConnector />
              <div className="min-w-0 flex-1">
                <SlotView slot={semi2} liveIds={liveIds} showLabel />
              </div>
            </div>
          </>
        }
      />
    );
  }

  // Estándar: las semis vienen de la fase de grupos, sin ronda previa.
  return (
    <Board
      liveIds={liveIds}
      final={final}
      bronze={bronze}
     
      semis={
        <>
          <SlotView slot={semi1} liveIds={liveIds} showLabel />
          <SlotView slot={semi2} liveIds={liveIds} showLabel />
        </>
      }
    />
  );
}

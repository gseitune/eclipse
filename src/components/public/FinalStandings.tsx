"use client";

import { useState } from "react";
import { pickDefaultEtapa } from "@/lib/front/tabs";
import type { RankingResponse } from "@/lib/front/types";
import { Podium } from "./Podium";

/**
 * Final standings of a single etapa: podium with the top three only, rendered
 * as bare content inside the TournamentTabs card. The etapa is chosen from the
 * ranking and defaults to the one the viewer is on; the tab itself stays
 * locked until that fecha is closed.
 */
export function FinalStandings({
  ranking,
  etapaId,
}: {
  ranking: RankingResponse | null;
  etapaId: string | null;
}) {
  const [selectedEtapaId, setSelectedEtapaId] = useState<string | null>(null);

  if (!ranking) {
    return <p className="text-sm text-stone-400">Cargando posiciones…</p>;
  }

  const defaultEtapa = pickDefaultEtapa(ranking.etapas, etapaId);

  if (!defaultEtapa) {
    return <p className="text-sm text-stone-400">Aún no hay etapas cargadas</p>;
  }

  const selectedEtapa =
    ranking.etapas.find((e) => e.id === selectedEtapaId) ?? defaultEtapa;

  const hasResults = selectedEtapa.finished && selectedEtapa.positions.length > 0;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Elegir etapa</span>
        <select
          value={selectedEtapa.id}
          onChange={(e) => setSelectedEtapaId(e.target.value)}
          className="min-h-[44px] w-48 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {ranking.etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.name}
              {!etapa.finished ? " (en curso)" : ""}
            </option>
          ))}
        </select>
      </label>

      {hasResults ? (
        <div className="rounded-xl border border-sand-200 bg-white/40 p-3">
          <Podium positions={selectedEtapa.positions} />
        </div>
      ) : (
        <p className="rounded-xl border border-sand-200 bg-white/40 p-4 text-sm text-stone-400">
          Las posiciones finales se publican al cerrar la fecha.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { fetchRanking } from "@/lib/front/api";
import type { RankingResponse } from "@/lib/front/types";
import { ApiError } from "@/lib/front/types";

const SCALE_LABEL =
  "Puntos: 1° 100 · 2° 80 · 3° 65 · 4° 50 · 5°-6° 40 · 7° 30 · 8° 25 · 9°+ 10";

export function RankingPanel() {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEtapaId, setSelectedEtapaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRanking()
      .then((resp) => {
        if (!cancelled) {
          setData(resp);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : String(err);
          setError(msg);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Top-ranked team for highlight
  const topTeamId = data?.ranking[0]?.teamId ?? null;

  // Default selection: first etapa with registered positions, else first one
  const selectedEtapa =
    data?.etapas.find((e) => e.id === selectedEtapaId) ??
    data?.etapas.find((e) => e.positions.length > 0) ??
    data?.etapas[0] ??
    null;

  return (
    <section
      aria-label="Puntos del circuito"
      className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200"
    >
      <h2 className="text-lg font-semibold text-stone-900">
        Puntos del circuito
      </h2>
      <p className="text-xs text-stone-400 mt-1">
        Ranking anual por parejas
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
          Cargando ranking…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      ) : data ? (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* LEFT COLUMN: Annual ranking */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-2">
              Ranking anual
            </h3>
            {data.ranking.length === 0 ? (
              <p className="text-sm text-stone-400">
                Aún no hay puntos acumulados
              </p>
            ) : (
              <ol className="space-y-1">
                {data.ranking.map((team, idx) => (
                  <li
                    key={team.teamId}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      team.teamId === topTeamId
                        ? "bg-amber-50/60 font-semibold text-amber-800"
                        : "text-stone-700"
                    }`}
                  >
                    <span className="w-5 text-center font-bold text-stone-400">
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate">{team.teamName}</span>
                    <span className="font-semibold text-stone-900">
                      {team.points}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* RIGHT COLUMN: Positions per etapa (selectable) */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-2">
              Posiciones por etapa
            </h3>
            {data.etapas.length === 0 ? (
              <p className="text-sm text-stone-400">
                Aún no hay etapas cargadas
              </p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="sr-only">Elegir etapa</span>
                  <select
                    value={selectedEtapa?.id ?? ""}
                    onChange={(e) => setSelectedEtapaId(e.target.value)}
                    className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                  >
                    {data.etapas.map((etapa) => (
                      <option key={etapa.id} value={etapa.id}>
                        {etapa.name}
                        {!etapa.finished ? " (en curso)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedEtapa ? (
                  <div className="rounded-lg border border-sand-200 bg-white/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-stone-800">
                        {selectedEtapa.name}
                      </span>
                      {!selectedEtapa.finished && (
                        <span className="text-[10px] font-semibold text-stone-400">
                          Etapa en curso — aún no suma puntos
                        </span>
                      )}
                    </div>
                    {selectedEtapa.finished &&
                    selectedEtapa.positions.length > 0 ? (
                      <ol className="mt-1.5 space-y-0.5">
                        {selectedEtapa.positions.map((pos) => (
                          <li
                            key={pos.teamId}
                            className="flex items-center gap-1.5 text-xs text-stone-600"
                          >
                            <span className="w-4 text-center font-bold text-stone-400">
                              {pos.position}
                            </span>
                            <span className="flex-1 truncate">
                              {pos.teamName}
                            </span>
                            <span className="text-stone-900">
                              {pos.points}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-1 text-xs text-stone-400">
                        Sin posiciones registradas
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Scale note */}
      <p className="mt-4 text-[11px] text-stone-400">{SCALE_LABEL}</p>
    </section>
  );
}

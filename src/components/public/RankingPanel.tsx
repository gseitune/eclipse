"use client";

import { useState, useEffect } from "react";
import { fetchRanking } from "@/lib/front/api";
import type { RankingResponse } from "@/lib/front/types";
import { ApiError } from "@/lib/front/types";

const SCALE_LABEL =
  "Puntos: 1° 100 · 2° 80 · 3° 65 · 4° 50 · 5°-6° 40 · 7° 30 · 8° 25 · 9°+ 10";

/* ── Podium star (gold / silver / bronze) ── */
function MedalStar({
  tier,
  compact = false,
}: {
  tier: "gold" | "silver" | "bronze";
  compact?: boolean;
}) {
  const colorClass =
    tier === "gold"
      ? "text-yellow-400"
      : tier === "silver"
        ? "text-slate-400"
        : "text-amber-700";
  const label = tier === "gold" ? "Oro" : tier === "silver" ? "Plata" : "Bronce";
  return (
    <span
      className={`${compact ? "w-4" : "w-5"} inline-flex justify-center`}
      role="img"
      aria-label={`${label} — puesto`}
      title={`${label} — puesto`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`h-4 w-4 ${colorClass}`}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function RankBadge({
  index,
  compact = false,
}: {
  index: number;
  compact?: boolean;
}) {
  if (index === 0) return <MedalStar tier="gold" compact={compact} />;
  if (index === 1) return <MedalStar tier="silver" compact={compact} />;
  if (index === 2) return <MedalStar tier="bronze" compact={compact} />;
  return (
    <span
      className={`${compact ? "w-4" : "w-5"} text-center font-bold text-stone-400`}
    >
      {index + 1}
    </span>
  );
}

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
        Ranking anual por jugador
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
          Cargando ranking…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      ) : data ? (
        <div className="mt-4">
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* LEFT COLUMN: Femenino */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-2">
              Femenino
            </h3>
            {data.female.length === 0 ? (
              <p className="text-sm text-stone-400">
                Aún no hay puntos acumulados
              </p>
            ) : (
              <ol className="space-y-1">
                {data.female.map((player, idx) => (
                  <li
                    key={player.name}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm`}
                  >
                    <RankBadge index={idx} />
                    <span className="flex-1 truncate">{player.name}</span>
                    <span className="font-semibold text-stone-900">
                      {player.points}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* MIDDLE COLUMN: Masculino */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-2">
              Masculino
            </h3>
            {data.male.length === 0 ? (
              <p className="text-sm text-stone-400">
                Aún no hay puntos acumulados
              </p>
            ) : (
              <ol className="space-y-1">
                {data.male.map((player, idx) => (
                  <li
                    key={player.name}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm`}
                  >
                    <RankBadge index={idx} />
                    <span className="flex-1 truncate">{player.name}</span>
                    <span className="font-semibold text-stone-900">
                      {player.points}
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
                          Episodio en curso — aún no suma puntos
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
                            <RankBadge index={pos.position - 1} compact />
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
        </div>
      ) : null}

      {/* Scale note */}
      <p className="mt-4 text-[11px] text-stone-400">{SCALE_LABEL}</p>
    </section>
  );
}
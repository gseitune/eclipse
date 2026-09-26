"use client";

import { useState, useEffect } from "react";
import { fetchRanking } from "@/lib/front/api";
import type { RankingResponse, EtapaPosition } from "@/lib/front/types";
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

/* ── Trophy icon (gold / silver / bronze) with a star in the middle ── */
function TrophyIcon({
  tier,
  className = "h-8 w-8",
}: {
  tier: "gold" | "silver" | "bronze";
  className?: string;
}) {
  const cupClass =
    tier === "gold"
      ? "text-yellow-400"
      : tier === "silver"
        ? "text-slate-300"
        : "text-amber-700";
  const starClass =
    tier === "gold"
      ? "fill-amber-50"
      : tier === "silver"
        ? "fill-white"
        : "fill-amber-100";
  const label =
    tier === "gold" ? "Oro" : tier === "silver" ? "Plata" : "Bronce";
  return (
    <span
      className={`inline-flex ${cupClass}`}
      role="img"
      aria-label={`Trofeo ${label}`}
      title={`Trofeo ${label}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        {/* Cup body */}
        <path d="M7 3h10a1 1 0 0 1 1 1v2a5.5 5.5 0 0 1-4.2 5.35A3 3 0 0 1 12 13a3 3 0 0 1-1.8-1.65A5.5 5.5 0 0 1 6 6V4a1 1 0 0 1 1-1Z" />
        {/* Handles */}
        <path
          d="M7.2 4H4.8v.8a3.3 3.3 0 0 0 2.9 3.28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M16.8 4h2.4v.8a3.3 3.3 0 0 1-2.9 3.28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Stem */}
        <path d="M11 13.5h2v3.5h-2z" />
        {/* Base */}
        <path d="M7.4 20h9.2l-.6-2H8l-.6 2Z" />
        {/* Star in the middle */}
        <path
          className={starClass}
          d="M12 7.1l.9 1.9 2 .3-1.5 1.4.4 2L12 11.8l-1.8.9.4-2-1.5-1.4 2-.3.9-1.9Z"
        />
      </svg>
    </span>
  );
}

/* ── Podium: 1° top-center (gold trophy), 2° bottom-left (silver), 3° bottom-right (bronze) ── */
function Podium({ positions }: { positions: EtapaPosition[] }) {
  const top1 = positions.find((p) => p.position === 1);
  const top2 = positions.find((p) => p.position === 2);
  const top3 = positions.find((p) => p.position === 3);
  if (!top1 && !top2 && !top3) return null;

  return (
    <div className="mt-5 grid grid-cols-3 items-end gap-2">
      {/* 2nd — bottom-left silver */}
      <div className="flex flex-col items-center">
        <TrophyIcon tier="silver" className="h-7 w-7" />
        <p className="mt-1.5 w-full truncate text-center text-sm font-medium text-stone-700">
          {top2?.teamName ?? "—"}
        </p>
        <p className="mt-1 flex h-6 w-full items-center justify-center rounded-t-lg bg-slate-300 text-xs font-bold text-stone-700">
          2°
        </p>
      </div>

      {/* 1st — top-center gold */}
      <div className="flex flex-col items-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Campeón
        </p>
        <TrophyIcon tier="gold" className="mt-0.5 h-10 w-10" />
        <p className="mt-1.5 w-full truncate text-center text-base font-bold text-stone-900">
          {top1?.teamName ?? "—"}
        </p>
        <p className="mt-1 flex h-9 w-full items-center justify-center rounded-t-lg bg-yellow-400 text-sm font-bold text-stone-900">
          1°
        </p>
      </div>

      {/* 3rd — bottom-right bronze */}
      <div className="flex flex-col items-center">
        <TrophyIcon tier="bronze" className="h-6 w-6" />
        <p className="mt-1.5 w-full truncate text-center text-sm font-medium text-stone-700">
          {top3?.teamName ?? "—"}
        </p>
        <p className="mt-1 flex h-5 w-full items-center justify-center rounded-t-lg bg-amber-700/70 text-xs font-bold text-amber-50">
          3°
        </p>
      </div>
    </div>
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
          {selectedEtapa && selectedEtapa.finished && (
            <Podium positions={selectedEtapa.positions} />
          )}

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
"use client";

import { useState, useEffect } from "react";
import { fetchRanking } from "@/lib/front/api";
import type { Circuit, RankingResponse } from "@/lib/front/types";
import { ApiError } from "@/lib/front/types";
import { PositionMark } from "./PositionMark";

/* ── Posición: el número pesa más que una estrella ── */
function RankBadge({ index }: { index: number }) {
  return (
    <PositionMark
      position={index + 1}
      tone="metal"
      className="h-5 w-8 rounded-sm text-[12px] font-bold sm:h-6 sm:w-9 sm:text-xs"
    />
  );
}

function RankingColumn({
  title,
  players,
  limit,
}: {
  title: string;
  players: RankingResponse["female"];
  limit: number | null;
}) {
  const shown = limit === null ? players : players.slice(0, limit);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[12px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
          {title}
        </h3>
        <span className="text-[12px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">
          Pts
        </span>
      </div>

      {players.length === 0 ? (
        <p className="text-[15px] sm:text-sm text-stone-400">Aún no hay puntos acumulados</p>
      ) : (
        <ol className="space-y-1">
          {shown.map((player, idx) => (
            <li
              key={player.name}
              className={`flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-[14px] sm:gap-2.5 sm:px-2 sm:py-2 sm:text-sm ${
                idx === 0 ? "bg-tierra-50" : ""
              }`}
            >
              <RankBadge index={idx} />
              <span className="min-w-0 flex-1 truncate text-stone-700">
                {player.name}
              </span>
              <span
                className={`shrink-0 tabular-nums ${
                  idx < 3
                    ? "font-bold text-stone-900"
                    : "font-semibold text-stone-600"
                }`}
              >
                {player.points}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Annual circuit ranking by player. The per-etapa final standings now live in
 * the home's "Posiciones finales" tab (see FinalStandings).
 */
export function RankingPanel({ circuit }: { readonly circuit: Circuit }) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRanking(circuit)
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
  }, [circuit]);

  if (loading) {
    return (
      <section
        aria-label="Puntos del circuito"
        className="rounded-2xl border border-selva-200 bg-selva-50 p-4 shadow-[0_18px_40px_-34px_rgba(23,43,24,0.28)] sm:p-6"
      >
        <div className="flex items-center gap-2 text-[15px] sm:text-sm text-stone-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-selva-600 border-t-transparent" />
          Cargando ranking…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Puntos del circuito"
        className="rounded-2xl border border-selva-200 bg-selva-50 p-4 shadow-[0_18px_40px_-34px_rgba(23,43,24,0.28)] sm:p-6"
      >
        <p className="text-[15px] sm:text-sm text-red-500">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const total = Math.max(data.female.length, data.male.length);
  const limit = expanded ? null : 4;

  return (
    <section
      aria-label="Puntos del circuito"
      className="rounded-2xl border border-selva-200 bg-selva-50 p-4 shadow-[0_18px_40px_-34px_rgba(23,43,24,0.28)] sm:p-6"
    >
      <h2 className="text-lg font-semibold text-stone-900">
        Puntos del circuito
      </h2>
      <p className="mt-1 text-[13px] sm:text-xs text-stone-500">Ranking anual por jugador</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-6">
        <RankingColumn title="Femenino" players={data.female} limit={limit} />
        <RankingColumn title="Masculino" players={data.male} limit={limit} />
      </div>

      {total > 4 && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-[13px] sm:text-xs font-semibold text-stone-600 transition-colors hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600"
          >
            {expanded ? "Ver menos" : "Ver todos"}
          </button>
        </div>
      )}
    </section>
  );
}

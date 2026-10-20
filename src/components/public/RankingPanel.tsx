"use client";

import { useState, useEffect } from "react";
import { fetchRanking } from "@/lib/front/api";
import type { Circuit, RankingResponse } from "@/lib/front/types";
import { ApiError } from "@/lib/front/types";

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
        : "text-amber-700"; /* bronze — reserved, do not use for UI */
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

/**
 * Annual circuit ranking by player. The per-etapa final standings now live in
 * the home's "Posiciones finales" tab (see FinalStandings).
 */
export function RankingPanel({ circuit }: { readonly circuit: Circuit }) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200"
      >
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
          Cargando ranking…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Puntos del circuito"
        className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200"
      >
        <p className="text-sm text-red-500">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section
      aria-label="Puntos del circuito"
      className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200"
    >
      <h2 className="text-lg font-semibold text-stone-900">
        Puntos del circuito
      </h2>
      <p className="text-xs text-stone-400 mt-1">Ranking anual por jugador</p>

      <div className="mt-4 grid grid-cols-2 gap-6">
        {/* Femenino */}
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
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
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

        {/* Masculino */}
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
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
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
      </div>
    </section>
  );
}

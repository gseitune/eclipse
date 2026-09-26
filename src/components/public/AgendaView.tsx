"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { stageLabel } from "@/lib/front/phase";
import { liveMatchIds } from "@/lib/front/live";
import { fetchState } from "@/lib/front/api";
import { ApiError } from "@/lib/front/types";
import type { StateSnapshot, ScheduleRow, MatchPublic, DesempateMatchInfo } from "@/lib/front/types";
import { setWins } from "@/lib/front/types";

interface MatchInfo {
  teamA: string | null;
  teamB: string | null;
  status: MatchPublic["resultStatus"] | null;
  setA: number | null;
  setB: number | null;
  winnerName: string | null;
}

function buildMatchMap(
  brackets: MatchPublic[],
  nextMatch: MatchPublic | null,
): Map<string, MatchPublic> {
  const map = new Map<string, MatchPublic>();
  for (const b of brackets) map.set(b.id, b);
  if (nextMatch) map.set(nextMatch.id, nextMatch);
  return map;
}

function resolveMatch(
  rowId: string,
  matchMap: Map<string, MatchPublic>,
  despMatch: DesempateMatchInfo | null,
): MatchInfo {
  const m = matchMap.get(rowId);
  if (m) {
    const sw = setWins(m.sets);
      return {
        teamA: m.teamA?.name ?? null,
        teamB: m.teamB?.name ?? null,
        status: m.resultStatus,
        setA: sw.a,
        setB: sw.b,
        winnerName: m.winner?.name ?? null,
      };
  }
  if (despMatch && despMatch.id === rowId) {
    return {
      teamA: despMatch.teamA?.name ?? null,
      teamB: despMatch.teamB?.name ?? null,
      status: "PENDING",
      setA: null,
      setB: null,
      winnerName: null,
    };
  }
  return { teamA: null, teamB: null, status: null, setA: null, setB: null, winnerName: null };
}

function formatResult(info: MatchInfo): string {
  if (info.status === "COMPLETE") {
    return `${info.setA ?? "—"} - ${info.setB ?? "—"}`;
  }
  if (info.status === "WINNER_ONLY") {
    return info.winnerName ? `Ganó ${info.winnerName}` : "Ganó";
  }
  return "vs";
}

export function AgendaView({ initial }: { initial: StateSnapshot | null }) {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(initial);
  const [loading, setLoading] = useState<boolean>(!initial);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchState();
      setSnapshot(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount if no initial data provided by server
  useEffect(() => {
    if (initial !== null) return;
    let cancelled = false;
    fetchState()
      .then((data) => {
        if (!cancelled) {
          setSnapshot(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveIds = useMemo(
    () => (snapshot ? liveMatchIds(snapshot.schedule, snapshot.matchMinutes) : new Set<string>()),
    [snapshot],
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/90 backdrop-blur ring-1 ring-inset ring-sand-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm font-semibold text-stone-700 hover:text-stone-900 transition-colors min-h-[44px] items-center"
          >
            <span aria-hidden="true">←</span> Volver
          </Link>
          <h1 className="text-lg font-semibold text-stone-900">Agenda</h1>
          <button
            onClick={refetch}
            disabled={loading}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-stone-700/50 hover:bg-stone-800 disabled:opacity-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Actualizar agenda"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>

      {/* Loading state */}
      {loading && !snapshot && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
            <span className="text-sm text-stone-600">Cargando agenda…</span>
          </div>
        </div>
      )}

      {/* Agenda content */}
      {snapshot && (
        <AgendaContent snapshot={snapshot} liveIds={liveIds} error={error} />
      )}
    </div>
  );
}

function AgendaContent({
  snapshot,
  liveIds,
  error,
}: {
  snapshot: StateSnapshot;
  liveIds: Set<string>;
  error: string | null;
}) {
  const matchMap = useMemo(
    () => buildMatchMap(snapshot.brackets, snapshot.nextMatch),
    [snapshot.brackets, snapshot.nextMatch],
  );

  const despMatch = snapshot.desempate.match;

  // Group schedule rows by stage, preserving data order
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const row of snapshot.schedule) {
      const stage = row.stage;
      if (!map.has(stage)) map.set(stage, []);
      map.get(stage)!.push(row);
    }
    return map;
  }, [snapshot.schedule]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-8">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {snapshot.schedule.length === 0 ? (
        <div className="text-center text-sm text-stone-400">
          No hay partidos programados.
        </div>
      ) : (
        Array.from(groups.entries()).map(([stage, rows]) => (
          <section key={stage} aria-label={stageLabel(stage)}>
            <h2 className="mb-3 text-base font-semibold text-stone-900">
              {stageLabel(stage)}
            </h2>
            <div className="space-y-3">
              {rows.map((row) => {
                const info = resolveMatch(row.id, matchMap, despMatch);
                const isLive = liveIds.has(row.id);
                const windowText = row.estimated ?? row.scheduled;

                return (
                  <article
                    key={row.id}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                      isLive
                        ? "border-ember-400 bg-ember-50/40 ring-1 ring-inset ring-ember-200"
                        : "border-sand-300 bg-white/40 ring-1 ring-inset ring-sand-200"
                    }`}
                  >
                    {/* Slot / order */}
                    <span className="flex-shrink-0 text-sm font-semibold text-stone-400 min-w-[3rem]">
                      {row.slot}
                    </span>

                    {/* Team names / match info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900">
                        {info.teamA && info.teamB ? (
                          <>
                            <span>{info.teamA}</span>
                            {" vs "}
                            <span>{info.teamB}</span>
                          </>
                        ) : (
                          <span>Partido</span>
                        )}
                      </p>
                      {windowText && (
                        <p className="text-xs text-stone-500">{windowText}</p>
                      )}
                    </div>

                    {/* Result / status */}
                    <div className="flex-shrink-0 text-right">
                      {info.status === "PENDING" && isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember-500">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
                          EN VIVO
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-stone-700">
                          {formatResult(info)}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

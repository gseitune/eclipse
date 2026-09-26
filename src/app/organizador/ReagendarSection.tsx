"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchScheduleBoard, rescheduleMatch } from "@/lib/front/api";
import type { ScheduleBoardRow } from "@/lib/front/types";
import { ApiError } from "@/lib/front/types";
import { stageLabel } from "@/lib/front/phase";

/* ── Up arrow icon (inline SVG, no emoji) ── */
function UpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M14.707 12.293a1 1 0 01-1.414 0L10 8.414l-3.293 3.879a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── Down arrow icon (inline SVG, no emoji) ── */
function DownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.707a1 1 0 011.414 0L10 11.586l3.293-3.879a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── Props ── */
export interface ReagendarSectionProps {
  readonly onBack: () => void;
}

export function ReagendarSection({ onBack }: ReagendarSectionProps) {
  const [rows, setRows] = useState<ScheduleBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const refetch = useCallback(async () => {
    try {
      const data = await fetchScheduleBoard();
      setRows(data.schedule);
      setError(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchScheduleBoard();
        if (!cancelled) {
          setRows(data.schedule);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : String(err);
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Precompute whether each PENDING row has a PENDING neighbor in each direction
  function canMoveUp(index: number): boolean {
    for (let i = index - 1; i >= 0; i--) {
      if (rows[i].resultStatus === "PENDING") return true;
    }
    return false;
  }

  function canMoveDown(index: number): boolean {
    for (let i = index + 1; i < rows.length; i++) {
      if (rows[i].resultStatus === "PENDING") return true;
    }
    return false;
  }

  async function handleMove(matchId: string, direction: "up" | "down") {
    setSubmittingIds((prev) => new Set(prev).add(matchId));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    try {
      await rescheduleMatch(matchId, direction);
      await refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setRowErrors((prev) => ({ ...prev, [matchId]: msg }));
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  }

  const windowText = (row: ScheduleBoardRow): string => {
    if (row.estimated) return row.estimated;
    if (row.scheduled) return row.scheduled;
    return "";
  };

  if (loading) {
    return (
      <div className="flex flex-col mx-auto w-full max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-sand-300 bg-sand-50 text-stone-600 hover:bg-sand-100 transition-colors min-w-[44px] min-h-[44px]"
            aria-label="Volver"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-stone-900">Reagendar partidos</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
          Cargando…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col mx-auto w-full max-w-xl">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-sand-300 bg-sand-50 text-stone-600 hover:bg-sand-100 transition-colors min-w-[44px] min-h-[44px]"
          aria-label="Volver"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-stone-900">Reagendar partidos</h2>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={refetch}
            className="rounded-md border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 transition-colors min-h-[44px]"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Schedule board */}
      <section aria-label="Tablero del día">
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const isPending = row.resultStatus === "PENDING";
            const isSubmitting = submittingIds.has(row.id);
            const moveUpDisabled = !isPending || !canMoveUp(index) || isSubmitting;
            const moveDownDisabled = !isPending || !canMoveDown(index) || isSubmitting;

            return (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 hover:bg-sand-100 transition-colors"
              >
                {/* Order number */}
                <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700">
                  {row.slot}
                </span>

                {/* Window + stage + teams */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-stone-900">
                    {windowText(row) || "—"}
                  </span>
                  <span className="mx-1.5 text-stone-300">·</span>
                  <span className="text-xs text-stone-500">
                    {stageLabel(row.stage)}
                  </span>
                  <div className="text-sm text-stone-600 mt-0.5">
                    {row.teamA && row.teamB
                      ? `${row.teamA.name} vs ${row.teamB.name}`
                      : "Por definir"}
                  </div>
                </div>

                {/* Status chip */}
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isPending
                      ? "bg-amber-100 text-amber-700"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {isPending ? "Pendiente" : "Jugado"}
                </span>

                {/* Move buttons (PENDING only) */}
                {isPending && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(row.id, "up")}
                      disabled={moveUpDisabled}
                      className={`flex items-center justify-center w-7 h-7 rounded border transition-colors min-w-[28px] min-h-[28px] ${
                        moveUpDisabled
                          ? "border-sand-200 bg-sand-100 text-stone-300 cursor-not-allowed"
                          : "border-sand-300 bg-white text-stone-600 hover:bg-sand-50"
                      }`}
                      aria-label={`Mover ${row.teamA?.name ?? "?"} hacia arriba`}
                    >
                      <UpIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(row.id, "down")}
                      disabled={moveDownDisabled}
                      className={`flex items-center justify-center w-7 h-7 rounded border transition-colors min-w-[28px] min-h-[28px] ${
                        moveDownDisabled
                          ? "border-sand-200 bg-sand-100 text-stone-300 cursor-not-allowed"
                          : "border-sand-300 bg-white text-stone-600 hover:bg-sand-50"
                      }`}
                      aria-label={`Mover ${row.teamA?.name ?? "?"} hacia abajo`}
                    >
                      <DownIcon />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Row-level errors */}
        {Object.entries(rowErrors).map(([id, msg]) => (
          <p key={id} className="mt-1 text-xs text-red-500">
            {msg}
          </p>
        ))}
      </section>
    </div>
  );
}

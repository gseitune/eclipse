"use client";

import { useState, useCallback, useMemo } from "react";
import { useLiveState } from "../../lib/front/use-live-state";
import { recordResult } from "../../lib/front/api";
import type { MatchPublic, DesempateInfo, ScheduleRow } from "../../lib/front/types";
import { ApiError } from "../../lib/front/types";
import { stageLabel } from "../../lib/front/phase";

/* ── Check icon (inline SVG, no emoji) ── */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 flex-shrink-0 text-green-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── Props ── */
export interface ResultadosSectionProps {
  readonly onBack: () => void;
}

type EntryTab = "sets" | "winner";

/* ── Helper: window text from schedule ── */
function windowText(schedule: ScheduleRow[], matchId: string | null): string {
  if (!matchId) return "";
  const row = schedule.find((s) => s.id === matchId);
  if (!row) return "";
  if (row.estimated) return row.estimated;
  if (row.scheduled) return row.scheduled;
  return "";
}

/* ── Helper: count and list pending matches ── */
function computePending(
  brackets: MatchPublic[],
  desempate: DesempateInfo,
): { count: number; list: Array<{ stage: string; teams: string }> } {
  const bracketPending = brackets.filter((m) => m.resultStatus === "PENDING");
  const desempatePending = desempate.pending && desempate.match ? 1 : 0;

  // Build list without double-counting
  const idsInList = new Set<string>();
  const list: Array<{ stage: string; teams: string }> = [];

  for (const m of bracketPending) {
    if (idsInList.has(m.id)) continue;
    idsInList.add(m.id);
    const teams =
      m.teamA && m.teamB
        ? `${m.teamA.name} vs ${m.teamB.name}`
        : m.teamA?.name ?? m.teamB?.name ?? "Desconocido";
    list.push({ stage: stageLabel(m.stage), teams });
  }

  if (desempatePending && desempate.match) {
    const dm = desempate.match;
    const dmKey = `desempate-${dm.id}`;
    if (!idsInList.has(dmKey)) {
      idsInList.add(dmKey);
      const teams =
        dm.teamA && dm.teamB
          ? `${dm.teamA.name} vs ${dm.teamB.name}`
          : dm.teamA?.name ?? dm.teamB?.name ?? "Desconocido";
      list.push({ stage: "Desempate", teams });
    }
  }

  return { count: bracketPending.length + desempatePending, list };
}

/* ── Main component ── */
export function ResultadosSection({ onBack }: ResultadosSectionProps) {
  const { state, loading, error, refetch } = useLiveState();

  const [activeTab, setActiveTab] = useState<EntryTab>("sets");
  const [setAScore, setSetAScore] = useState("");
  const [setBScore, setSetBScore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const brackets = useMemo(() => state?.brackets ?? [], [state?.brackets]);
  const desempate = useMemo(
    () => state?.desempate ?? { needed: false, pending: false, match: null },
    [state?.desempate],
  );
  const nextMatch = state?.nextMatch ?? null;
  const schedule = state?.schedule ?? [];

  const pendingInfo = useMemo(
    () => computePending(brackets, desempate),
    [brackets, desempate],
  );

  // Early-tournament case: no fixture data at all
  const earlyTournament = brackets.length === 0 && !desempate.pending;

  // Handle record result with error classification
  const handleRecord = useCallback(
    async (input: { matchId: string; setAScore?: number; setBScore?: number; winnerId?: string }) => {
      setSubmitting(true);
      setSubmitMsg(null);
      try {
        await recordResult(input);
        setSubmitMsg("Resultado cargado");
        // Reset form
        setSetAScore("");
        setSetBScore("");
        setActiveTab("sets");
        // Refetch state via live hook
        await refetch();
      } catch (err) {
        if (err instanceof ApiError) {
          switch (err.status) {
            case 401:
              setSubmitMsg("Sesión vencida. Volvé a iniciar sesión.");
              break;
            case 409:
              setSubmitMsg("Este partido ya tiene resultado cargado.");
              break;
            default:
              setSubmitMsg("Error al cargar el resultado. Intentá de nuevo.");
          }
        } else {
          setSubmitMsg("Error al cargar el resultado. Intentá de nuevo.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [refetch],
  );

  // Sets submission
  const handleSetsSubmit = useCallback(() => {
    if (!nextMatch) return;
    const a = parseInt(setAScore, 10);
    const b = parseInt(setBScore, 10);
    // Client-side validation
    if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) {
      setSubmitMsg("Ambos sets deben ser números positivos.");
      return;
    }
    if (a === b) {
      setSubmitMsg("Los sets no pueden ser iguales.");
      return;
    }
    handleRecord({ matchId: nextMatch.id, setAScore: a, setBScore: b });
  }, [nextMatch, setAScore, setBScore, handleRecord]);

  // Winner submission
  const handleWinnerSubmit = useCallback(
    (winnerId: string) => {
      if (!nextMatch) return;
      handleRecord({ matchId: nextMatch.id, winnerId });
    },
    [nextMatch, handleRecord],
  );

  return (
    <div className="flex flex-col">
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
        <h2 className="text-lg font-semibold text-stone-900">Resultados</h2>
      </div>

      {/* ── Part 1: Checklist ── */}
      <section aria-label="Checklist de partidos pendientes" className="mb-8">
        <h3 className="text-sm font-semibold text-stone-700 mb-2">
          Faltan partidos
        </h3>
        {earlyTournament ? (
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <span className="text-stone-300 text-lg">—</span>
            <span>No hay datos suficientes</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-stone-600 mb-2">
              Faltan <span className="font-semibold text-stone-900">{pendingInfo.count}</span>{" "}
              partido{pendingInfo.count !== 1 ? "s" : ""} por cargar
            </p>
            {pendingInfo.list.length > 0 && (
              <ul className="space-y-1">
                {pendingInfo.list.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm text-stone-500 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sunset-400 flex-shrink-0" />
                    <span>
                      {item.stage} — {item.teams}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ── Part 2: Quick entry ── */}
      <section aria-label="Cargar resultado" className="mb-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Cargar resultado
        </h3>

        {!nextMatch ? (
          <p className="text-sm text-stone-400 py-4">No hay partido para cargar</p>
        ) : (
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-5 space-y-4">
            {/* Match info */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  {stageLabel(nextMatch.stage)}
                </span>
                <p className="text-base font-semibold text-stone-900 mt-0.5">
                  {nextMatch.teamA?.name ?? "?"} vs {nextMatch.teamB?.name ?? "?"}
                </p>
              </div>
              {windowText(schedule, nextMatch.id) && (
                <span className="text-xs text-stone-400 whitespace-nowrap">
                  {windowText(schedule, nextMatch.id)}
                </span>
              )}
            </div>

            {/* Tab switch */}
            <div
              role="tablist"
              className="inline-flex rounded-lg bg-stone-100 p-1 gap-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "sets"}
                onClick={() => { setActiveTab("sets"); setSubmitMsg(null); }}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                  activeTab === "sets"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Sets
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "winner"}
                onClick={() => { setActiveTab("winner"); setSubmitMsg(null); }}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                  activeTab === "winner"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                1 ganador
              </button>
            </div>

            {/* Sets inputs */}
            {activeTab === "sets" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label htmlFor="set-a" className="sr-only">
                    Sets del equipo A
                  </label>
                  <input
                    id="set-a"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={setAScore}
                    onChange={(e) => setSetAScore(e.target.value)}
                    disabled={submitting}
                    placeholder="0"
                    className="w-20 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-center text-lg font-semibold text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                  />
                  <span className="text-stone-400 font-medium">—</span>
                  <label htmlFor="set-b" className="sr-only">
                    Sets del equipo B
                  </label>
                  <input
                    id="set-b"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={setBScore}
                    onChange={(e) => setSetBScore(e.target.value)}
                    disabled={submitting}
                    placeholder="0"
                    className="w-20 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-center text-lg font-semibold text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSetsSubmit}
                  disabled={submitting || !setAScore || !setBScore}
                  className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  {submitting ? "Cargando…" : "Cargar resultado"}
                </button>
              </div>
            )}

            {/* Winner buttons */}
            {activeTab === "winner" && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleWinnerSubmit(nextMatch.teamAId!)}
                  disabled={submitting || !nextMatch.teamAId}
                  className="flex-1 rounded-xl border-2 border-sand-300 bg-white py-4 px-4 text-center font-semibold text-stone-900 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  <span className="block text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{nextMatch.teamA?.name ?? "Equipo A"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWinnerSubmit(nextMatch.teamBId!)}
                  disabled={submitting || !nextMatch.teamBId}
                  className="flex-1 rounded-xl border-2 border-sand-300 bg-white py-4 px-4 text-center font-semibold text-stone-900 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  <span className="block text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{nextMatch.teamB?.name ?? "Equipo B"}</span>
                </button>
              </div>
            )}

            {/* Submit message */}
            {submitMsg && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                  submitMsg === "Resultado cargado"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
                role="alert"
              >
                {submitMsg === "Resultado cargado" ? <CheckIcon /> : null}
                <span>{submitMsg}</span>
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <p className="text-xs text-stone-400">Actualizando…</p>
            )}
            {error && !submitMsg && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

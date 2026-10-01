"use client";

import { useState, useCallback, useMemo } from "react";
import { useLiveState } from "../../lib/front/use-live-state";
import { recordResult, setMatchTimes, resolveBestThird } from "../../lib/front/api";
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

/* ── Lock icon (inline SVG — inactive match board) ── */
function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 flex-shrink-0 text-stone-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
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

/* ── Date helpers for manual times (datetime-local ↔ ISO) ── */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatTimeRange(
  startIso: string | null,
  endIso: string | null,
): string | null {
  if (!startIso) return null;
  try {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    const s = fmt(startIso);
    const e = endIso ? fmt(endIso) : s;
    return `${s} – ${e}`;
  } catch {
    return null;
  }
}

function classifyTimesError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Sesión vencida. Volvé a iniciar sesión.";
    if (err.status === 400) {
      if (err.message.includes("End time"))
        return "El fin debe ser después del inicio.";
      if (err.message.includes("Invalid date")) return "Fecha inválida.";
      return err.message;
    }
    if (err.status === 404) return "Partido no encontrado.";
    if (err.status === 409) return err.message;
    return err.message;
  }
  return "Error al guardar el horario. Intentá de nuevo.";
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

  // Manual-time modal state
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  const brackets = useMemo(() => state?.brackets ?? [], [state?.brackets]);
  const desempate = useMemo(
    () => state?.desempate ?? { needed: false, pending: false, match: null },
    [state?.desempate],
  );
  const nextMatch = state?.nextMatch ?? null;
  const schedule = useMemo(() => state?.schedule ?? [], [state?.schedule]);

  // Best-third tie: the organizer names which tied third goes straight to
  // CUARTOS_4; the repechage takes the other two.
  const bestThirdTie = useMemo(() => {
    const blocked = state?.bracketsBlocked;
    if (blocked?.reason !== "best_third_tie") return null;
    const names = new Map<string, string>();
    for (const teams of Object.values(state?.zones ?? {})) {
      for (const t of teams) names.set(t.id, t.name);
    }
    return blocked.teamIds.map((id) => ({ id, name: names.get(id) ?? "Equipo" }));
  }, [state?.bracketsBlocked, state?.zones]);
  const [tieTeamId, setTieTeamId] = useState<string | null>(null);
  const [tieMsg, setTieMsg] = useState<string | null>(null);

  async function handleResolveBestThird(teamId: string) {
    if (!state?.etapaId || tieTeamId) return;
    setTieTeamId(teamId);
    setTieMsg(null);
    try {
      await resolveBestThird(state.etapaId, teamId);
      setTieMsg("Listo — el repechage quedó armado.");
      await refetch();
    } catch (err) {
      setTieMsg(err instanceof ApiError ? err.message : String(err));
    } finally {
      setTieTeamId(null);
    }
  }

  const pendingInfo = useMemo(
    () => computePending(brackets, desempate),
    [brackets, desempate],
  );

  // Early-tournament case: no fixture data at all
  const earlyTournament = brackets.length === 0 && !desempate.pending;

  // Handle record result with error classification
  const handleRecord = useCallback(
    async (input: { matchId: string; setFormat?: string; sets?: { teamA: number; teamB: number }[]; winnerId?: string }) => {
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
    handleRecord({
      matchId: nextMatch.id,
      setFormat: nextMatch.setFormat ?? "SINGLE_21",
      sets: [{ teamA: a, teamB: b }],
    });
  }, [nextMatch, setAScore, setBScore, handleRecord]);

  // Winner submission (WINNER_ONLY: no invented scores, just the winner)
  const handleWinnerSubmit = useCallback(
    (winnerId: string) => {
      if (!nextMatch) return;
      handleRecord({ matchId: nextMatch.id, winnerId });
    },
    [nextMatch, handleRecord],
  );

  // Manual-time ops
  const manualRow = useMemo(
    () => (nextMatch ? schedule.find((s) => s.id === nextMatch.id) ?? null : null),
    [nextMatch, schedule],
  );
  const manualStart = manualRow?.manualStartAt ?? null;
  const manualEnd = manualRow?.manualEndAt ?? null;
  const hasManualTime = manualStart != null;
  const manualRange = formatTimeRange(manualStart, manualEnd);

  function openTimeModal() {
    // Prefill with current manual values, otherwise empty
    setTimeStart(manualStart ? toDatetimeLocal(new Date(manualStart)) : "");
    setTimeEnd(manualEnd ? toDatetimeLocal(new Date(manualEnd)) : "");
    setTimeError(null);
    setTimeOpen(true);
  }

  function closeTimeModal() {
    if (timeSaving) return;
    setTimeOpen(false);
    setTimeError(null);
  }

  async function handleSaveTimes() {
    if (!nextMatch || timeSaving) return;
    setTimeSaving(true);
    setTimeError(null);
    try {
      // Partial update: only send fields the organizer set.
      const startIso = timeStart ? new Date(timeStart).toISOString() : undefined;
      const endIso = timeEnd ? new Date(timeEnd).toISOString() : undefined;
      await setMatchTimes(nextMatch.id, { startAt: startIso, endAt: endIso });
      setTimeOpen(false);
      await refetch();
    } catch (err) {
      setTimeError(classifyTimesError(err));
    } finally {
      setTimeSaving(false);
    }
  }

  async function handleRemoveTimes() {
    if (!nextMatch || timeSaving) return;
    setTimeSaving(true);
    setTimeError(null);
    try {
      await setMatchTimes(nextMatch.id, { startAt: null, endAt: null });
      setTimeOpen(false);
      await refetch();
    } catch (err) {
      setTimeError(classifyTimesError(err));
    } finally {
      setTimeSaving(false);
    }
  }

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

      {/* ── Best-third tie resolution ── */}
      {bestThirdTie && (
        <section
          aria-label="Elegir mejor tercer puesto"
          className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5"
        >
          <h3 className="text-sm font-semibold text-stone-900 mb-1">
            Empate en el mejor 3.º
          </h3>
          <p className="text-xs text-stone-600 mb-4">
            Con un set por partido de zona, los terceros quedan empatados. Elegí
            cuál entra directo a Cuartos 4; los otros dos juegan el repechage.
          </p>
          <div className="flex flex-col gap-2">
            {bestThirdTie.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleResolveBestThird(t.id)}
                disabled={tieTeamId !== null}
                className="flex items-center justify-between rounded-lg border border-sand-300 bg-white px-4 py-3 text-left transition-colors hover:border-amber-soft-400 hover:bg-amber-50 disabled:opacity-50 min-h-[44px]"
              >
                <span className="text-sm font-semibold text-stone-900">
                  {t.name}
                </span>
                <span className="text-xs font-medium text-stone-500">
                  {tieTeamId === t.id ? "Guardando…" : "Es el mejor 3.º"}
                </span>
              </button>
            ))}
          </div>
          {tieMsg && (
            <p
              className={`mt-3 text-xs font-medium ${tieMsg.startsWith("Listo") ? "text-green-700" : "text-red-700"}`}
              role="alert"
            >
              {tieMsg}
            </p>
          )}
        </section>
      )}

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

      {/* ── Part 2: Match scoreboard ── */}
      <section aria-label="Cargar resultado" className="mb-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Cargar resultado
        </h3>

        {!nextMatch ? (
          /* Inactive board — gray with lock */
          <div className="flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-stone-100/70 px-6 py-10 text-stone-400">
            <LockIcon />
            <span className="text-sm font-medium">
              Sin partido activo
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-sand-300 bg-sand-50 p-5 space-y-4">
            {/* Match label + window */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  {stageLabel(nextMatch.stage)}
                </span>
                {hasManualTime ? (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {manualRange}
                  </p>
                ) : (
                  windowText(schedule, nextMatch.id) && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {windowText(schedule, nextMatch.id)}
                    </p>
                  )
                )}
                <button
                  type="button"
                  onClick={openTimeModal}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-sand-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-100 transition-colors min-h-[28px]"
                >
                  ⏰ {hasManualTime ? "Editar horario" : "Cargar horario"}
                </button>
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
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px] ${
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
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                    activeTab === "winner"
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  1 ganador
                </button>
              </div>
            </div>

            {/* Sets scoreboard — teams on each side, number in the middle */}
            {activeTab === "sets" && (
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {/* Team A */}
                  <div className="text-right">
                    <span className="block text-base font-semibold text-stone-900">
                      {nextMatch.teamA?.name ?? "Equipo A"}
                    </span>
                    {nextMatch.teamA && (
                      <span className="block text-[11px] text-stone-400 mt-0.5">
                        Equipo A
                      </span>
                    )}
                  </div>

                  {/* Middle score */}
                  <div className="flex items-center gap-2">
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
                      className="w-16 rounded-lg border border-sand-300 bg-white px-2 py-2.5 text-center text-lg font-bold text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                    />
                    <span className="text-stone-400 font-bold">:</span>
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
                      className="w-16 rounded-lg border border-sand-300 bg-white px-2 py-2.5 text-center text-lg font-bold text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                    />
                  </div>

                  {/* Team B */}
                  <div className="text-left">
                    <span className="block text-base font-semibold text-stone-900">
                      {nextMatch.teamB?.name ?? "Equipo B"}
                    </span>
                    {nextMatch.teamB && (
                      <span className="block text-[11px] text-stone-400 mt-0.5">
                        Equipo B
                      </span>
                    )}
                  </div>
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
                  className="flex-1 rounded-xl border-2 border-sand-300 bg-white py-4 px-4 text-center font-semibold text-stone-900 hover:border-amber-soft-400 hover:bg-amber-50 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  <span className="block text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{nextMatch.teamA?.name ?? "Equipo A"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWinnerSubmit(nextMatch.teamBId!)}
                  disabled={submitting || !nextMatch.teamBId}
                  className="flex-1 rounded-xl border-2 border-sand-300 bg-white py-4 px-4 text-center font-semibold text-stone-900 hover:border-amber-soft-400 hover:bg-amber-50 disabled:opacity-50 transition-colors min-h-[44px]"
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

      {/* ── Manual time modal ── */}
      {timeOpen && nextMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cargar horario del partido"
        >
          <div className="w-full max-w-md rounded-2xl border border-sand-300 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Horario del partido
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              {nextMatch.teamA?.name ?? "Equipo A"} vs{" "}
              {nextMatch.teamB?.name ?? "Equipo B"}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="time-start"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Inicio
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="time-start"
                    type="datetime-local"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    disabled={timeSaving}
                    className="flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setTimeStart(toDatetimeLocal(new Date()))}
                    disabled={timeSaving}
                    className="shrink-0 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Ahora mismo
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="time-end"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Fin
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="time-end"
                    type="datetime-local"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    disabled={timeSaving}
                    className="flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setTimeEnd(toDatetimeLocal(new Date()))}
                    disabled={timeSaving}
                    className="shrink-0 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Ahora mismo
                  </button>
                </div>
              </div>

              {timeError && (
                <p
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 border border-red-200"
                  role="alert"
                >
                  {timeError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRemoveTimes}
                  disabled={timeSaving || (!hasManualTime && !timeStart && !timeEnd)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  Quitar horario
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeTimeModal}
                    disabled={timeSaving}
                    className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-50 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTimes}
                    disabled={timeSaving || (!timeStart && !timeEnd)}
                    className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    {timeSaving ? "Guardando…" : "Guardar horario"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

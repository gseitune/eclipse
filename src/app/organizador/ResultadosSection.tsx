"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  editResult,
  fetchState,
  fetchScheduleBoard,
  recordResult,
  setMatchTimes,
  resolveBestThird,
  createBestThirdDesempate,
  reslotEtapa,
} from "../../lib/front/api";
import {
  STAGE_FORMATS,
  describeSetProblem,
  type SetFormatId,
} from "@/lib/result-format";
import type {
  ScheduleBoardRow,
  ScheduleRow,
  StandingRow,
  StateSnapshot,
} from "../../lib/front/types";
import { ApiError } from "../../lib/front/types";
import { stageLabel } from "../../lib/front/phase";
import { cascadeImpact, matchScore } from "../../lib/front/bracket";

/* ── Set-format labels for the organizer result form ── */
function setFormatLabel(format: SetFormatId): string {
  switch (format) {
    case "SINGLE_21":
      return "1 set a 21";
    case "TWO_15_TIEBREAK":
      return "2 sets a 15";
    case "TWO_21_TIEBREAK_15":
      return "2 sets a 21";
    case "BEST_OF_3_21":
      return "Mejor de 3 a 21";
  }
}

function setFormatHint(format: SetFormatId): string {
  switch (format) {
    case "SINGLE_21":
      return "Un set a 21, con 2 de ventaja.";
    case "TWO_15_TIEBREAK":
      return "Dos sets a 15; si van 1-1, el tercero a 15.";
    case "TWO_21_TIEBREAK_15":
      return "Dos sets a 21; si van 1-1, el tercero a 15.";
    case "BEST_OF_3_21":
      return "Mejor de 3 sets a 21.";
  }
}

/* ── Check icon (inline SVG, no emoji) ── */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 flex-shrink-0 text-selva-600"
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
export interface ResultadoEntryPanelProps {
  readonly state: StateSnapshot | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => Promise<void>;
}

export interface MejoresTercerosPanelProps {
  readonly state: StateSnapshot | null;
  readonly refetch: () => Promise<void>;
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

/* ── Main component ── */
export function ResultadoEntryPanel({
  state,
  loading,
  error,
  refetch,
}: ResultadoEntryPanelProps) {
  const [activeTab, setActiveTab] = useState<EntryTab>("sets");
  const [setAScore, setSetAScore] = useState("");
  const [setBScore, setSetBScore] = useState("");
  const [set2A, setSet2A] = useState("");
  const [set2B, setSet2B] = useState("");
  const [set3A, setSet3A] = useState("");
  const [set3B, setSet3B] = useState("");
  // Only used when the etapa keeps the per-stage convention and the stage
  // allows more than one format (semifinals: 1 set to 21 or 2 sets to 15).
  const [formatChoice, setFormatChoice] = useState<SetFormatId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  // Manual-time modal state
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  const nextMatch = state?.nextMatch ?? null;
  const schedule = useMemo(() => state?.schedule ?? [], [state?.schedule]);

  // The etapa can fix one format for every match; otherwise the stage decides
  // which formats are legal (semifinals allow both).
  const etapaFormat = state?.etapa?.setFormat ?? null;
  const allowedFormats = useMemo<readonly SetFormatId[]>(() => {
    if (!nextMatch) return [];
    if (etapaFormat) return [etapaFormat];
    return STAGE_FORMATS[nextMatch.stage] ?? [];
  }, [nextMatch, etapaFormat]);
  const activeFormat: SetFormatId =
    formatChoice && allowedFormats.includes(formatChoice)
      ? formatChoice
      : (allowedFormats[0] ?? "SINGLE_21");
  const needsSecondSet = activeFormat !== "SINGLE_21";

  // The third set appears only after a real 1-1 split.
  const firstTwo = [
    parseInt(setAScore, 10),
    parseInt(setBScore, 10),
    parseInt(set2A, 10),
    parseInt(set2B, 10),
  ];
  const firstTwoFilled = firstTwo.every((n) => !Number.isNaN(n));
  const showThirdSet =
    needsSecondSet &&
    firstTwoFilled &&
    (firstTwo[0] > firstTwo[1]) !== (firstTwo[2] > firstTwo[3]);

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
        setSet2A("");
        setSet2B("");
        setSet3A("");
        setSet3B("");
        setActiveTab("sets");
        // Refetch state via live hook
        await refetch();
      } catch (err) {
        // The POST can fail AFTER the server persisted the result (e.g. a
        // gateway timeout on the shared deployment). Reconcile with the server
        // so the UI never stays stale — and report success when it did land.
        let saved = false;
        try {
          const snapshot = await fetchState();
          saved = snapshot.nextMatch?.id !== input.matchId;
        } catch {
          // ignore; fall through to the error message
        }
        if (saved) {
          setSubmitMsg("Resultado cargado");
          setSetAScore("");
          setSetBScore("");
          setSet2A("");
          setSet2B("");
          setSet3A("");
          setSet3B("");
          setActiveTab("sets");
        } else if (err instanceof ApiError) {
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
        await refetch();
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
    const sets = [{ teamA: a, teamB: b }];

    if (needsSecondSet) {
      const a2 = parseInt(set2A, 10);
      const b2 = parseInt(set2B, 10);
      if (!Number.isNaN(a2) && !Number.isNaN(b2)) {
        sets.push({ teamA: a2, teamB: b2 });
      }
      // The third set only exists after a 1-1 split.
      const firstTwoFilled =
        !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(a2) && !Number.isNaN(b2);
      const splitOneOne =
        firstTwoFilled && (a > b) !== (a2 > b2);
      if (splitOneOne) {
        const a3 = parseInt(set3A, 10);
        const b3 = parseInt(set3B, 10);
        if (!Number.isNaN(a3) && !Number.isNaN(b3)) {
          sets.push({ teamA: a3, teamB: b3 });
        }
      }
    }

    const problem = describeSetProblem(activeFormat, sets);
    if (problem) {
      setSubmitMsg(problem);
      return;
    }

    handleRecord({
      matchId: nextMatch.id,
      setFormat: activeFormat,
      sets,
    });
  }, [
    nextMatch,
    setAScore,
    setBScore,
    set2A,
    set2B,
    set3A,
    set3B,
    needsSecondSet,
    activeFormat,
    handleRecord,
  ]);

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
    <div className="space-y-6">
      {/* ── Match scoreboard ── */}
      <section aria-label="Cargar resultado" className="mb-6">
        <h3 className="text-[15px] sm:text-sm font-semibold text-stone-700 mb-3">
          Cargar resultado
        </h3>

        {!nextMatch ? (
          /* Inactive board — gray with lock */
          <div className="flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-stone-100/70 px-6 py-10 text-stone-400">
            <LockIcon />
            <span className="text-[15px] sm:text-sm font-medium">
              Sin partido activo
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-sand-300 bg-sand-50 p-5 space-y-4">
            {/* Match label + window */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[13px] sm:text-xs font-medium text-stone-500 uppercase tracking-wide">
                  {stageLabel(nextMatch.stage)}
                </span>
                {hasManualTime ? (
                  <p className="text-[13px] sm:text-xs text-stone-400 mt-0.5">
                    {manualRange}
                  </p>
                ) : (
                  windowText(schedule, nextMatch.id) && (
                    <p className="text-[13px] sm:text-xs text-stone-400 mt-0.5">
                      {windowText(schedule, nextMatch.id)}
                    </p>
                  )
                )}
                <button
                  type="button"
                  onClick={openTimeModal}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-sand-300 bg-white px-2 py-1 text-[12px] sm:text-[11px] font-medium text-stone-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-100 transition-colors min-h-[28px]"
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
                  className={`px-3 py-2 text-[15px] sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${
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
                  className={`px-3 py-2 text-[15px] sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  {/* Team A */}
                  <div className="text-left sm:text-right">
                    <span className="block text-base font-semibold text-stone-900">
                      {nextMatch.teamA?.name ?? "Equipo A"}
                    </span>
                    {nextMatch.teamA && (
                      <span className="block text-[12px] sm:text-[11px] text-stone-400 mt-0.5">
                        Equipo A
                      </span>
                    )}
                  </div>

                  {/* Middle score */}
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
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
                      <span className="block text-[12px] sm:text-[11px] text-stone-400 mt-0.5">
                        Equipo B
                      </span>
                    )}
                  </div>
                </div>

                {allowedFormats.length > 1 && (
                  <div>
                    <label
                      htmlFor="resultado-formato"
                      className="block text-[13px] sm:text-xs font-medium text-stone-600 mb-1"
                    >
                      Formato del partido
                    </label>
                    <select
                      id="resultado-formato"
                      value={activeFormat}
                      onChange={(e) =>
                        setFormatChoice(e.target.value as SetFormatId)
                      }
                      disabled={submitting}
                      className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-[15px] sm:text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                    >
                      {allowedFormats.map((format) => (
                        <option key={format} value={format}>
                          {setFormatLabel(format)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="text-[12px] sm:text-[11px] text-stone-500">
                  {setFormatHint(activeFormat)}
                </p>

                {needsSecondSet && (
                  <div className="space-y-3 rounded-lg border border-sand-200 bg-white/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] sm:text-xs font-medium text-stone-600">
                        Segundo set
                      </span>
                      <div className="flex items-center gap-2">
                        <label htmlFor="set2-a" className="sr-only">
                          Segundo set del equipo A
                        </label>
                        <input
                          id="set2-a"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={set2A}
                          onChange={(e) => setSet2A(e.target.value)}
                          disabled={submitting}
                          placeholder="0"
                          className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                        />
                        <span className="text-stone-400 font-bold">:</span>
                        <label htmlFor="set2-b" className="sr-only">
                          Segundo set del equipo B
                        </label>
                        <input
                          id="set2-b"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={set2B}
                          onChange={(e) => setSet2B(e.target.value)}
                          disabled={submitting}
                          placeholder="0"
                          className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                        />
                      </div>
                    </div>

                    {showThirdSet && (
                      <div className="flex items-center justify-between gap-3 border-t border-sand-200 pt-3">
                        <span className="text-[13px] sm:text-xs font-medium text-stone-600">
                          Tercer set (van 1-1)
                        </span>
                        <div className="flex items-center gap-2">
                          <label htmlFor="set3-a" className="sr-only">
                            Tercer set del equipo A
                          </label>
                          <input
                            id="set3-a"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={set3A}
                            onChange={(e) => setSet3A(e.target.value)}
                            disabled={submitting}
                            placeholder="0"
                            className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                          />
                          <span className="text-stone-400 font-bold">:</span>
                          <label htmlFor="set3-b" className="sr-only">
                            Tercer set del equipo B
                          </label>
                          <input
                            id="set3-b"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={set3B}
                            onChange={(e) => setSet3B(e.target.value)}
                            disabled={submitting}
                            placeholder="0"
                            className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSetsSubmit}
                  disabled={submitting || !setAScore || !setBScore}
                  className="w-full rounded-lg bg-tierra-900 px-4 py-3 text-[15px] sm:text-sm font-semibold text-white hover:bg-tierra-950 disabled:opacity-50 transition-colors min-h-[44px]"
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
                  <span className="block text-[15px] sm:text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{nextMatch.teamA?.name ?? "Equipo A"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWinnerSubmit(nextMatch.teamBId!)}
                  disabled={submitting || !nextMatch.teamBId}
                  className="flex-1 rounded-xl border-2 border-sand-300 bg-white py-4 px-4 text-center font-semibold text-stone-900 hover:border-amber-soft-400 hover:bg-amber-50 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  <span className="block text-[15px] sm:text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{nextMatch.teamB?.name ?? "Equipo B"}</span>
                </button>
              </div>
            )}

            {/* Submit message */}
            {submitMsg && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-[15px] sm:text-sm font-medium ${
                  submitMsg === "Resultado cargado"
                    ? "bg-selva-50 text-selva-700 border border-selva-200"
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
              <p className="text-[13px] sm:text-xs text-stone-400">Actualizando…</p>
            )}
            {error && !submitMsg && (
              <p className="text-[13px] sm:text-xs text-red-500">{error}</p>
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
            <p className="mt-1 text-[15px] sm:text-sm text-stone-500">
              {nextMatch.teamA?.name ?? "Equipo A"} vs{" "}
              {nextMatch.teamB?.name ?? "Equipo B"}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="time-start"
                  className="block text-[13px] sm:text-xs font-medium text-stone-600 mb-1"
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
                    className="flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-[15px] sm:text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setTimeStart(toDatetimeLocal(new Date()))}
                    disabled={timeSaving}
                    className="shrink-0 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2.5 text-[15px] sm:text-sm font-medium text-stone-600 hover:bg-sand-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Ahora mismo
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="time-end"
                  className="block text-[13px] sm:text-xs font-medium text-stone-600 mb-1"
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
                    className="flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-[15px] sm:text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setTimeEnd(toDatetimeLocal(new Date()))}
                    disabled={timeSaving}
                    className="shrink-0 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2.5 text-[15px] sm:text-sm font-medium text-stone-600 hover:bg-sand-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Ahora mismo
                  </button>
                </div>
              </div>

              {timeError && (
                <p
                  className="rounded-lg bg-red-50 px-3 py-2 text-[13px] sm:text-xs font-medium text-red-700 border border-red-200"
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
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[15px] sm:text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  Quitar horario
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeTimeModal}
                    disabled={timeSaving}
                    className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-[15px] sm:text-sm font-medium text-stone-600 hover:bg-sand-50 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTimes}
                    disabled={timeSaving || (!timeStart && !timeEnd)}
                    className="rounded-lg bg-tierra-900 px-4 py-2.5 text-[15px] sm:text-sm font-semibold text-white hover:bg-tierra-950 disabled:opacity-50 transition-colors min-h-[44px]"
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

/* ── Correction of blocked results (cascade) ── */
export interface CorregirResultadosPanelProps {
  readonly refetch: () => Promise<void>;
  /** Closed etapa: the board stays visible but nothing can be corrected. */
  readonly readOnly?: boolean;
}

type CorrTab = "sets" | "winner";

/**
 * Lets the organizer correct a match whose descendant phase already played
 * (editable === false). The confirmation dialog previews exactly which results
 * the cascade will clear (same tables the backend uses) before the PATCH with
 * `cascade: true` is sent.
 */
export function CorregirResultadosPanel({
  refetch,
  etapaId = null,
  readOnly = false,
}: CorregirResultadosPanelProps & { readonly etapaId?: string | null }) {
  const [board, setBoard] = useState<ScheduleBoardRow[] | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<ScheduleBoardRow | null>(null);
  const [corrTab, setCorrTab] = useState<CorrTab>("sets");
  const [corrA, setCorrA] = useState("");
  const [corrB, setCorrB] = useState("");
  const [corr2A, setCorr2A] = useState("");
  const [corr2B, setCorr2B] = useState("");
  const [corr3A, setCorr3A] = useState("");
  const [corr3B, setCorr3B] = useState("");
  const [corrWinner, setCorrWinner] = useState<string | null>(null);
  const [corrSaving, setCorrSaving] = useState(false);
  const [corrMsg, setCorrMsg] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // Without an etapa there is nothing to correct; never fall back to the
    // default circuit or the list would show another etapa's matches.
    if (!etapaId) {
      setBoard([]);
      return;
    }
    try {
      const res = await fetchScheduleBoard(etapaId);
      setBoard(res.schedule);
      setBoardError(null);
    } catch (err) {
      setBoard(null);
      setBoardError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar los partidos jugados.",
      );
    }
  }, [etapaId]);

  useEffect(() => {
    // `reload` only sets state after its await, but the rule cannot see through
    // the async boundary: this is a data fetch on mount, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const blocked = useMemo(
    () => (board ?? []).filter((row) => row.resultStatus !== "PENDING"),
    [board],
  );

  // The stored format of the match decides how many sets the correction needs.
  const corrFormat: SetFormatId = (openRow?.setFormat ?? "SINGLE_21") as SetFormatId;

  const corrFirstTwo = [
    parseInt(corrA, 10),
    parseInt(corrB, 10),
    parseInt(corr2A, 10),
    parseInt(corr2B, 10),
  ];
  const showCorrThird =
    corrFormat !== "SINGLE_21" &&
    corrFirstTwo.every((n) => !Number.isNaN(n)) &&
    (corrFirstTwo[0] > corrFirstTwo[1]) !== (corrFirstTwo[2] > corrFirstTwo[3]);

  const corrSets = useMemo(() => {
    if (corrTab !== "sets") return [];
    const sets = [
      { teamA: parseInt(corrA, 10), teamB: parseInt(corrB, 10) },
    ];
    if (corrFormat !== "SINGLE_21") {
      const a2 = parseInt(corr2A, 10);
      const b2 = parseInt(corr2B, 10);
      if (!Number.isNaN(a2) && !Number.isNaN(b2)) {
        sets.push({ teamA: a2, teamB: b2 });
      }
      if (showCorrThird) {
        const a3 = parseInt(corr3A, 10);
        const b3 = parseInt(corr3B, 10);
        if (!Number.isNaN(a3) && !Number.isNaN(b3)) {
          sets.push({ teamA: a3, teamB: b3 });
        }
      }
    }
    return sets;
  }, [corrTab, corrA, corrB, corr2A, corr2B, corr3A, corr3B, corrFormat, showCorrThird]);

  const impact = useMemo(
    () => (openRow ? cascadeImpact(openRow.stage, board ?? []) : null),
    [openRow, board],
  );

  function openCorrection(row: ScheduleBoardRow) {
    setOpenRow(row);
    setCorrTab("sets");
    setCorrA("");
    setCorrB("");
    setCorr2A("");
    setCorr2B("");
    setCorr3A("");
    setCorr3B("");
    setCorrWinner(null);
    setCorrMsg(null);
  }

  const scoreText = useCallback((row: ScheduleBoardRow): string => {
    const s = matchScore(row);
    if (s) return `Actual: ${s.a} - ${s.b}`;
    return "Resultado cargado";
  }, []);

  const canConfirm =
    !corrSaving &&
    openRow !== null &&
    (corrTab === "sets"
      ? describeSetProblem(corrFormat, corrSets) === null
      : corrWinner !== null);

  async function handleCorregir() {
    if (!openRow || !canConfirm || corrSaving) return;
    setCorrSaving(true);
    setCorrMsg(null);
    try {
      if (corrTab === "sets") {
        await editResult({
          matchId: openRow.id,
          setFormat: corrFormat,
          sets: corrSets,
          cascade: true,
        });
      } else if (corrWinner) {
        await editResult({
          matchId: openRow.id,
          winnerId: corrWinner,
          cascade: true,
        });
      }
      setOpenRow(null);
      setDoneMsg(
        "Resultado corregido — la cadena afectada se invalidó y la llave se recalculó.",
      );
      await refetch();
      await reload();
    } catch (err) {
      setCorrMsg(
        err instanceof ApiError
          ? err.message
          : "Error al corregir el resultado. Intentá de nuevo.",
      );
    } finally {
      setCorrSaving(false);
    }
  }

  if (boardError) {
    return (
      <section
        aria-label="Corregir resultados trabados"
        className="rounded-xl border border-sand-200 bg-stone-100/70 p-5"
      >
        <p className="text-[13px] sm:text-xs font-medium text-red-700" role="alert">
          {boardError}
        </p>
      </section>
    );
  }

  if (blocked.length === 0) return null;

  const clearedLabels = (impact?.cleared ?? []).map((r) => {
    const row = r as ScheduleBoardRow;
    return `${stageLabel(row.stage)} — ${row.teamA?.name ?? "—"} vs ${row.teamB?.name ?? "—"}`;
  });
  const nulledLabels = (impact?.nulledStages ?? []).map(stageLabel);

  return (
    <>
      <section
        aria-label="Corregir resultados trabados"
        className="rounded-xl border border-sand-300 bg-sand-50 p-5 space-y-3"
      >
        <div>
          <span className="block text-[15px] sm:text-sm font-semibold text-stone-900">
            Corregir resultados
          </span>
          <span className="mt-0.5 block text-[13px] sm:text-xs text-stone-500">
            {readOnly
              ? "Etapa finalizada: los resultados quedan sólo para consulta."
              : "Todos los partidos jugados de esta etapa. Corregir uno borra solo la cadena afectada y la vuelve a calcular."}
          </span>
        </div>

        {doneMsg && (
          <p
            className="rounded-lg bg-selva-50 px-3 py-2 text-[13px] sm:text-xs font-medium text-selva-700 border border-selva-200"
            role="alert"
          >
            {doneMsg}
          </p>
        )}

        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {blocked.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-sand-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <span className="block truncate text-[15px] sm:text-sm font-semibold text-stone-900">
                  {stageLabel(row.stage)} — {row.teamA?.name ?? "Equipo A"} vs{" "}
                  {row.teamB?.name ?? "Equipo B"}
                </span>
                <span className="mt-0.5 block text-[13px] sm:text-xs text-stone-500">
                  {scoreText(row)}
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => openCorrection(row)}
                  className="shrink-0 rounded-lg bg-tierra-900 px-3 py-2 text-[13px] sm:text-xs font-semibold text-white transition-colors hover:bg-tierra-950 min-h-[36px]"
                >
                  Corregir
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Correction dialog: new result + cascade preview */}
      {openRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Corregir resultado"
        >
          <div className="w-full max-w-md rounded-2xl border border-sand-300 bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-semibold text-stone-900">
                Corregir resultado
              </h3>
              <p className="mt-1 text-[15px] sm:text-sm text-stone-500">
                {stageLabel(openRow.stage)} — {openRow.teamA?.name ?? "Equipo A"} vs{" "}
                {openRow.teamB?.name ?? "Equipo B"}
              </p>
            </div>

            <div
              role="tablist"
              className="inline-flex rounded-lg bg-stone-100 p-1 gap-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={corrTab === "sets"}
                onClick={() => {
                  setCorrTab("sets");
                  setCorrMsg(null);
                }}
                className={`px-3 py-2 text-[15px] sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                  corrTab === "sets"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Sets
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={corrTab === "winner"}
                onClick={() => {
                  setCorrTab("winner");
                  setCorrMsg(null);
                }}
                className={`px-3 py-2 text-[15px] sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                  corrTab === "winner"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                1 ganador
              </button>
            </div>

            {corrTab === "sets" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                <label htmlFor="corr-set-a" className="sr-only">
                  Sets del equipo A
                </label>
                <input
                  id="corr-set-a"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={corrA}
                  onChange={(e) => setCorrA(e.target.value)}
                  disabled={corrSaving}
                  placeholder="0"
                  className="w-16 rounded-lg border border-sand-300 bg-white px-2 py-2.5 text-center text-lg font-bold text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                />
                <span className="text-stone-400 font-bold">:</span>
                <label htmlFor="corr-set-b" className="sr-only">
                  Sets del equipo B
                </label>
                <input
                  id="corr-set-b"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={corrB}
                  onChange={(e) => setCorrB(e.target.value)}
                  disabled={corrSaving}
                  placeholder="0"
                  className="w-16 rounded-lg border border-sand-300 bg-white px-2 py-2.5 text-center text-lg font-bold text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                />
                </div>

                {corrFormat !== "SINGLE_21" && (
                  <div className="space-y-2 rounded-lg border border-sand-200 bg-stone-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] sm:text-xs font-medium text-stone-600">
                        Segundo set
                      </span>
                      <div className="flex items-center gap-2">
                        <label htmlFor="corr-set2-a" className="sr-only">
                          Segundo set del equipo A
                        </label>
                        <input
                          id="corr-set2-a"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={corr2A}
                          onChange={(e) => setCorr2A(e.target.value)}
                          disabled={corrSaving}
                          placeholder="0"
                          className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                        />
                        <span className="text-stone-400 font-bold">:</span>
                        <label htmlFor="corr-set2-b" className="sr-only">
                          Segundo set del equipo B
                        </label>
                        <input
                          id="corr-set2-b"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={corr2B}
                          onChange={(e) => setCorr2B(e.target.value)}
                          disabled={corrSaving}
                          placeholder="0"
                          className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                        />
                      </div>
                    </div>

                    {showCorrThird && (
                      <div className="flex items-center justify-between gap-3 border-t border-sand-200 pt-2">
                        <span className="text-[13px] sm:text-xs font-medium text-stone-600">
                          Tercer set (van 1-1)
                        </span>
                        <div className="flex items-center gap-2">
                          <label htmlFor="corr-set3-a" className="sr-only">
                            Tercer set del equipo A
                          </label>
                          <input
                            id="corr-set3-a"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={corr3A}
                            onChange={(e) => setCorr3A(e.target.value)}
                            disabled={corrSaving}
                            placeholder="0"
                            className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                          />
                          <span className="text-stone-400 font-bold">:</span>
                          <label htmlFor="corr-set3-b" className="sr-only">
                            Tercer set del equipo B
                          </label>
                          <input
                            id="corr-set3-b"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={corr3B}
                            onChange={(e) => setCorr3B(e.target.value)}
                            disabled={corrSaving}
                            placeholder="0"
                            className="w-14 rounded-lg border border-sand-300 bg-white px-2 py-2 text-center text-base font-bold sm:w-16 text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-center text-[12px] sm:text-[11px] text-stone-500">
                  {setFormatHint(corrFormat)}
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCorrWinner(openRow.teamA?.id ?? null)}
                  disabled={corrSaving || !openRow.teamA?.id}
                  className={`flex-1 rounded-xl border-2 px-4 py-4 text-center font-semibold transition-colors min-h-[44px] ${
                    corrWinner === openRow.teamA?.id
                      ? "border-tierra-800 bg-tierra-50 text-stone-900"
                      : "border-sand-300 bg-white text-stone-900 hover:border-amber-soft-400 hover:bg-amber-50"
                  } disabled:opacity-50`}
                >
                  <span className="block text-[15px] sm:text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{openRow.teamA?.name ?? "Equipo A"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCorrWinner(openRow.teamB?.id ?? null)}
                  disabled={corrSaving || !openRow.teamB?.id}
                  className={`flex-1 rounded-xl border-2 px-4 py-4 text-center font-semibold transition-colors min-h-[44px] ${
                    corrWinner === openRow.teamB?.id
                      ? "border-tierra-800 bg-tierra-50 text-stone-900"
                      : "border-sand-300 bg-white text-stone-900 hover:border-amber-soft-400 hover:bg-amber-50"
                  } disabled:opacity-50`}
                >
                  <span className="block text-[15px] sm:text-sm text-stone-500 mb-1">Gana</span>
                  <span className="text-base">{openRow.teamB?.name ?? "Equipo B"}</span>
                </button>
              </div>
            )}

            {/* Cascade impact preview */}
            {(clearedLabels.length > 0 || nulledLabels.length > 0) && (
              <div
                className={`rounded-lg border px-4 py-3 ${
                  clearedLabels.length > 0
                    ? "border-red-200 bg-red-50"
                    : "border-amber-300 bg-amber-50"
                }`}
              >
                {clearedLabels.length > 0 && (
                  <>
                    <p className="text-[13px] sm:text-xs font-semibold text-red-800">
                      Si el ganador cambia, se borran los resultados de:
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {clearedLabels.map((label) => (
                        <li
                          key={label}
                          className="text-[13px] sm:text-xs text-red-700"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {nulledLabels.length > 0 && (
                  <p className="mt-1.5 text-[13px] sm:text-xs text-stone-600">
                    Si cambia el ganador, se vacían los cruces ({nulledLabels.join(", ")}) para
                    rearmar la llave desde el resultado corregido. Si solo corregís el
                    marcador, no se borra nada.
                  </p>
                )}
              </div>
            )}

            {corrMsg && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-[13px] sm:text-xs font-medium text-red-700 border border-red-200"
                role="alert"
              >
                {corrMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => !corrSaving && setOpenRow(null)}
                disabled={corrSaving}
                className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-[15px] sm:text-sm font-medium text-stone-600 hover:bg-sand-50 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCorregir}
                disabled={!canConfirm}
                className="rounded-lg bg-tierra-900 px-4 py-2.5 text-[15px] sm:text-sm font-semibold text-white hover:bg-tierra-950 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {corrSaving ? "Corrigiendo…" : "Corregir resultado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export function MejoresTercerosPanel({ state, refetch }: MejoresTercerosPanelProps) {
  const blocked = state?.bracketsBlocked;

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const teams of Object.values(state?.zones ?? {})) {
      for (const t of teams) map.set(t.id, t.name);
    }
    return map;
  }, [state?.zones]);

  const bestThirdTie = useMemo(() => {
    if (blocked?.reason !== "best_third_tie") return null;
    return blocked.teamIds.map((id) => ({ id, name: names.get(id) ?? "Equipo" }));
  }, [blocked, names]);

  const needsScores = useMemo(() => {
    if (blocked?.reason !== "best_third_needs_scores") return null;
    return blocked.teamIds.map((id) => ({ id, name: names.get(id) ?? "Equipo" }));
  }, [blocked, names]);

  // The best-third choice is only valid once every zone match is loaded. While
  // the next pending match is still a GROUP match, the zone stage is incomplete
  // (the server may already report the tie from partial standings).
  const zoneStageDone = useMemo(
    () => !state?.nextMatch || state.nextMatch.stage !== "GROUPS",
    [state?.nextMatch],
  );

  const desempatePending = Boolean(state?.desempate?.pending);

  const [tieTeamId, setTieTeamId] = useState<string | null>(null);
  const [tieMsg, setTieMsg] = useState<string | null>(null);
  const [creatingDesempate, setCreatingDesempate] = useState(false);

  async function handleResolveBestThird(teamId: string) {
    if (!state?.etapaId || tieTeamId || creatingDesempate) return;
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

  async function handleCreateDesempate() {
    if (!state?.etapaId || creatingDesempate || tieTeamId) return;
    setCreatingDesempate(true);
    setTieMsg(null);
    try {
      await createBestThirdDesempate(state.etapaId);
      setTieMsg("Desempate creado — cargá su resultado en el panel de partidos.");
      await refetch();
    } catch (err) {
      setTieMsg(err instanceof ApiError ? err.message : String(err));
    } finally {
      setCreatingDesempate(false);
    }
  }

  // Missing scores: the restricted comparison cannot run yet. Explain, no action.
  if (needsScores) {
    return (
      <section
        aria-label="Mejor 3.º — faltan marcadores"
        className="rounded-xl border border-sand-200 bg-stone-100/70 p-5"
      >
        <div className="mb-1 flex items-center gap-2">
          <LockIcon />
          <h3 className="text-[15px] sm:text-sm font-semibold text-stone-500">
            Mejor 3.º — faltan marcadores
          </h3>
        </div>
        <p className="text-[13px] sm:text-xs text-stone-400">
          Para comparar a los terceros hace falta el marcador de sus partidos
          contra el 1.º y 2.º de su zona. Cargá esos resultados para desbloquear
          Cuartos.
        </p>
      </section>
    );
  }

  if (!bestThirdTie) return null;

  // Zone stage still running — show a gray, disabled hint instead of the choice.
  if (!zoneStageDone) {
    return (
      <section
        aria-label="Empate en el mejor 3.º — pendiente de la fase de zonas"
        className="rounded-xl border border-sand-200 bg-stone-100/70 p-5"
      >
        <div className="mb-1 flex items-center gap-2">
          <LockIcon />
          <h3 className="text-[15px] sm:text-sm font-semibold text-stone-500">
            Empate en el mejor 3.º
          </h3>
        </div>
        <p className="text-[13px] sm:text-xs text-stone-400">
          Se habilita cuando estén cargados todos los resultados de la fase de
          zonas.
        </p>
      </section>
    );
  }

  // The organizer already chose the desempate path: the pending match owns the
  // tie now, so hide the choices and point at the match.
  if (desempatePending) {
    const dTeamA = state?.desempate?.match?.teamA?.name ?? "—";
    const dTeamB = state?.desempate?.match?.teamB?.name ?? "—";
    return (
      <section
        aria-label="Desempate del mejor 3.º — pendiente"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5"
      >
        <h3 className="text-[15px] sm:text-sm font-semibold text-stone-900 mb-1">
          Desempate del mejor 3.º
        </h3>
        <p className="text-[13px] sm:text-xs text-stone-600 mb-2">
          Los terceros empatados juegan el desempate{" "}
          <span className="font-semibold text-stone-900">
            {dTeamA} vs {dTeamB}
          </span>
          . Cargá su resultado en el panel de partidos y Cuartos se arma solo.
        </p>
        <p className="text-[13px] sm:text-xs text-stone-500">
          El ganador entra directo a Cuartos 4; el perdedor juega el repechage
          contra el tercero restante.
        </p>
      </section>
    );
  }

  const twoWayTie = bestThirdTie.length === 2;

  return (
    <section
      aria-label="Elegir mejor tercer puesto"
      className="rounded-xl border border-amber-300 bg-amber-50 p-5"
    >
      <h3 className="text-[15px] sm:text-sm font-semibold text-stone-900 mb-1">
        Empate en el mejor 3.º
      </h3>
      <p className="text-[13px] sm:text-xs text-stone-600 mb-4">
        Con un set por partido de zona, los terceros quedan empatados.
      </p>

      {twoWayTie && (
        <div className="mb-4 rounded-lg border border-sand-300 bg-white p-4">
          <p className="text-[15px] sm:text-sm font-semibold text-stone-900 mb-1">Desempate</p>
          <p className="text-[13px] sm:text-xs text-stone-600 mb-3">
            Los dos empatados juegan un partido extra. El ganador entra directo
            a Cuartos 4; el perdedor va al repechage contra el tercero que
            resta.
          </p>
          <button
            type="button"
            onClick={handleCreateDesempate}
            disabled={creatingDesempate || tieTeamId !== null}
            className="w-full rounded-lg border border-amber-soft-400 bg-amber-50 px-4 py-3 text-[15px] sm:text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-100 disabled:opacity-50 min-h-[44px]"
          >
            {creatingDesempate ? "Creando desempate…" : "Crear partido de desempate"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-sand-300 bg-white p-4">
        <p className="text-[15px] sm:text-sm font-semibold text-stone-900 mb-1">Sorteo</p>
        <p className="text-[13px] sm:text-xs text-stone-600 mb-3">
          {twoWayTie
            ? "Elegí cuál entra directo a Cuartos 4; el otro juega el repechage contra el tercero que resta."
            : "Elegí cuál entra directo a Cuartos 4; los otros dos juegan el repechage."}
        </p>
        <div className="flex flex-col gap-2">
          {bestThirdTie.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleResolveBestThird(t.id)}
              disabled={tieTeamId !== null || creatingDesempate}
              className="flex items-center justify-between rounded-lg border border-sand-300 bg-white px-4 py-3 text-left transition-colors hover:border-amber-soft-400 hover:bg-amber-50 disabled:opacity-50 min-h-[44px]"
            >
              <span className="text-[15px] sm:text-sm font-semibold text-stone-900">
                {t.name}
              </span>
              <span className="text-[13px] sm:text-xs font-medium text-stone-500">
                {tieTeamId === t.id ? "Guardando…" : "Es el mejor 3.º"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tieMsg && (
        <p
          className={`mt-3 text-[13px] sm:text-xs font-medium ${tieMsg.startsWith("Listo") || tieMsg.startsWith("Desempate creado") ? "text-selva-700" : "text-red-700"}`}
          role="alert"
        >
          {tieMsg}
        </p>
      )}
    </section>
  );
}

export interface RotationPanelProps {
  readonly state: StateSnapshot | null;
  readonly refetch: () => Promise<void>;
}

/**
 * One-shot repair for an etapa created before the rotation fix: re-orders the
 * group slots to the interleaved rotation (A, B, C, …) so no team plays two
 * group matches back-to-back. Offered only while the group phase is open and no
 * group result has been loaded (all standings at 0), so it can never disturb a
 * fixture that is already under way.
 */
export function RotationPanel({ state, refetch }: RotationPanelProps) {
  const untouched = useMemo(() => {
    if (!state || state.phase !== "GROUPS") return false;
    const rows = Object.values(state.standings ?? {})
      .flat()
      .filter((r): r is StandingRow => Boolean(r));
    return rows.length > 0 && rows.every((r) => r.played === 0);
  }, [state]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleReslot() {
    if (!state?.etapaId || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await reslotEtapa(state.etapaId);
      setMsg(
        res.moved > 0
          ? `Listo — ${res.moved} de ${res.total} partidos reordenados.`
          : "El fixture ya estaba en rotación; no hubo cambios.",
      );
      await refetch();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!untouched) return null;

  return (
    <section
      aria-label="Rotación del fixture"
      className="rounded-xl border border-sand-200 bg-stone-50 p-5"
    >
      <h3 className="text-[15px] sm:text-sm font-semibold text-stone-900 mb-1">
        Rotación del fixture
      </h3>
      <p className="text-[13px] sm:text-xs text-stone-600 mb-3">
        Reordena los partidos de zona en rotación (A, B, C, …) para que nadie
        juegue dos seguidos. Disponible solo antes de cargar resultados.
      </p>
      <button
        type="button"
        onClick={handleReslot}
        disabled={busy}
        className="w-full rounded-lg border border-sand-300 bg-white px-4 py-3 text-[15px] sm:text-sm font-semibold text-stone-900 transition-colors hover:bg-sand-100 disabled:opacity-50 min-h-[44px]"
      >
        {busy ? "Reordenando…" : "Reordenar rotación del fixture"}
      </button>
      {msg && (
        <p
          className={`mt-3 text-[13px] sm:text-xs font-medium ${msg.startsWith("Listo") || msg.startsWith("El fixture") ? "text-selva-700" : "text-red-700"}`}
          role="alert"
        >
          {msg}
        </p>
      )}
    </section>
  );
}

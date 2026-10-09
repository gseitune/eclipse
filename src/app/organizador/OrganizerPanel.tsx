"use client";

import { logout, closeEtapa } from "@/lib/front/api";
import { useState, useEffect, useMemo } from "react";
import { useLiveState } from "@/lib/front/use-live-state";
import { closeEtapaUi, type CloseEtapaUi } from "@/lib/etapa-close";
import type { MatchPublic, StateSnapshot } from "@/lib/front/types";
import { computeTimeEstimate } from "@/lib/time-estimate";
import { stageLabel } from "@/lib/front/phase";
import { ResultadoEntryPanel, MejoresTercerosPanel } from "./ResultadosSection";
import { CircuitosSection } from "./CircuitosSection";
import { ReagendarSection } from "./ReagendarSection";

/* ── Lock icon (inline SVG, no emoji, no external dependency) ── */
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

/* ── Bell icon (inline SVG, no emoji) ── */
function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 flex-shrink-0 text-amber-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  );
}

/* ── Top notification: the next match is waiting for its result ── */
function PendingNotice({ match }: { readonly match: MatchPublic | null }) {
  if (!match) return null;
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-4">
      <button
        type="button"
        onClick={() => {
          document
            .getElementById("resultados-card")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100 min-h-[44px]"
      >
        <BellIcon />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-stone-900">
            Falta cargar un resultado
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone-600">
            {stageLabel(match.stage)} — {match.teamA?.name ?? "Equipo A"} vs{" "}
            {match.teamB?.name ?? "Equipo B"}
          </span>
        </span>
        <span className="flex-shrink-0 text-xs font-semibold text-amber-700">
          Cargar →
        </span>
      </button>
    </div>
  );
}

/* ── Flag icon (inline SVG, no emoji) ── */
function FlagIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 flex-shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 2a1 1 0 011 1v14a1 1 0 11-2 0V3a1 1 0 011-1z" />
      <path d="M6.5 3.5h8.2a.8.8 0 01.65 1.26L13.4 7.5l1.95 2.74a.8.8 0 01-.65 1.26H6.5v-8z" />
    </svg>
  );
}

/* ── Check icon (inline SVG, no emoji) ── */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 flex-shrink-0 text-emerald-700"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L4.3 10.7a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── Close-etapa banner: unlocks only once the FINAL has a result ── */
function CloseEtapaBanner({
  uiState,
  busy,
  message,
  onRequestClose,
}: {
  readonly uiState: CloseEtapaUi;
  readonly busy: boolean;
  readonly message: string | null;
  readonly onRequestClose: () => void;
}) {
  if (uiState === "closed") {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 pt-4">
        <div className="flex w-full items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4">
          <CheckIcon />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-emerald-900">
              Etapa finalizada
            </span>
            <span className="mt-0.5 block text-xs text-emerald-800">
              Circuito cerrado: ya no se pueden cargar ni editar resultados.
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (uiState === "locked") {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 pt-4">
        <div
          role="group"
          aria-disabled="true"
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/50 px-5 py-4 opacity-60"
        >
          <LockIcon />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-stone-400">
              Finalizar etapa
            </span>
            <span className="mt-0.5 block text-xs text-stone-400">
              Se habilita cuando esté cargado el resultado de la final
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-4">
      <button
        type="button"
        onClick={onRequestClose}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-xl border border-amber-600 bg-amber-500 px-5 py-4 text-left text-white shadow-lg shadow-amber-500/30 transition-colors hover:bg-amber-600 disabled:opacity-60 min-h-[56px]"
      >
        <FlagIcon />
        <span className="flex-1 min-w-0">
          <span className="block text-base font-extrabold uppercase tracking-wide">
            Finalizar etapa
          </span>
          <span className="mt-0.5 block text-xs text-white/90">
            {busy
              ? "Cerrando…"
              : "Cierra el circuito con el resultado de la final"}
          </span>
        </span>
        <span className="flex-shrink-0 text-sm font-bold">Finalizar →</span>
      </button>
      {message && (
        <p
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          role="alert"
        >
          {message}
        </p>
      )}
    </div>
  );
}

/* ── Section kind ── */
type SectionKind = "actionable" | "disabled";

interface SectionConfig {
  readonly label: string;
  readonly hint: string;
  readonly kind: SectionKind;
}

const SECTIONS_DEFAULT: readonly SectionConfig[] = [
  {
    label: "Equipos",
    hint: "Crear y editar etapas con equipos",
    kind: "actionable",
  },
  {
    label: "Agenda de partidos",
    hint: "Ver y modificar el orden de los partidos del día",
    kind: "actionable",
  },
] as const;

const SECTIONS_CANCELLED: readonly SectionConfig[] = [
  {
    label: "Equipos",
    hint: "Crear y editar etapas con equipos",
    kind: "actionable",
  },
  {
    label: "Agenda de partidos",
    hint: "Etapa cancelada: sin acceso de edición",
    kind: "disabled",
  },
] as const;

/* ── Props ── */
export interface OrganizerPanelProps {
  readonly email: string;
}

/* ── Subcomponent: Actionable card ── */
function SectionCard({
  label,
  hint,
  onClick,
}: {
  readonly label: string;
  readonly hint: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-4 rounded-xl border border-sand-300 bg-sand-50 px-5 py-4 text-left ring-1 ring-inset ring-sand-200 hover:bg-sand-100 hover:ring-sand-300 transition-colors min-h-[44px]"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-stone-900">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-stone-500">
          {hint}
        </span>
      </span>
      <span className="text-sunset-500 text-sm font-medium flex-shrink-0 self-center">
        →
      </span>
    </button>
  );
}

/* ── Subcomponent: Disabled placeholder card ── */
function DisabledSectionCard({
  label,
  hint,
}: {
  readonly label: string;
  readonly hint: string;
}) {
  return (
    <div
      role="group"
      aria-disabled="true"
      className="flex w-full cursor-not-allowed items-start gap-4 rounded-xl border border-sand-200 bg-sand-50/50 px-5 py-4 opacity-50"
    >
      <LockIcon />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-stone-400">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-stone-400">
          {hint}
        </span>
      </span>
    </div>
  );
}

/* ── Subcomponent: Results card (inline result entry, no navigation) ── */
function ResultsCard({
  state,
  loading,
  error,
  refetch,
  disabled = false,
}: {
  readonly state: StateSnapshot | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => Promise<void>;
  readonly disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div
        role="group"
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-start gap-4 rounded-xl border border-sand-200 bg-sand-50/50 px-5 py-4 opacity-50"
      >
        <LockIcon />
        <span className="flex-1 min-w-0">
          <span className="block text-base font-bold text-stone-400">
            Resultados
          </span>
          <span className="mt-0.5 block text-xs text-stone-400">
            Etapa cancelada — sin acceso
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      id="resultados-card"
      className="scroll-mt-24 rounded-xl border border-sand-300 bg-sand-50 px-5 py-5 ring-1 ring-inset ring-sand-200"
    >
      <span className="block text-base font-bold text-stone-900">
        Resultados
      </span>
      <span className="mt-0.5 block text-xs text-stone-500">
        Cargar o corregir resultados
      </span>
      <div className="mt-4">
        <ResultadoEntryPanel
          state={state}
          loading={loading}
          error={error}
          refetch={refetch}
        />
      </div>
    </div>
  );
}

/* ── Clock formatting helpers ── */
function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatRemaining(ms: number): string {
  return `${Math.max(0, Math.round(ms / 60_000))} min`;
}

/* ── Subcomponent: always-visible reactive day counters ── */
function TimeCountersCard({
  nowMs,
  schedule,
  resultStatusById,
  matchMinutes,
}: {
  readonly nowMs: number;
  readonly schedule: { id: string; manualStartAt?: string | null; manualEndAt?: string | null }[];
  readonly resultStatusById: ReadonlyMap<string, string>;
  readonly matchMinutes: number;
}) {
  const estimate = useMemo(() => {
    const rows = schedule.map((row) => ({
      manualStartAt: row.manualStartAt ?? null,
      manualEndAt: row.manualEndAt ?? null,
      resultStatus: resultStatusById.get(row.id) ?? "PENDING",
    }));
    return computeTimeEstimate(rows, nowMs, matchMinutes * 60_000);
  }, [schedule, resultStatusById, nowMs, matchMinutes]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-4">
      <div className="rounded-xl border border-sand-300 bg-sand-50 px-5 py-4 ring-1 ring-inset ring-sand-200">
        {estimate ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-stone-700">
            <span>
              <span className="font-semibold text-stone-900">Inicio:</span>{" "}
              {formatClock(estimate.tournamentStart)}
            </span>
            <span>
              <span className="font-semibold text-stone-900">Transcurrido:</span>{" "}
              {formatElapsed(estimate.elapsedMs)}
            </span>
            <span>
              <span className="font-semibold text-stone-900">Restante estimado:</span>{" "}
              {formatRemaining(estimate.remainingMs)}
            </span>
            <span>
              <span className="font-semibold text-stone-900">Finalización estimada:</span>{" "}
              {formatClock(estimate.estimatedEndAt)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            Sin horario definido — cargá el horario del primer partido
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Main panel ── */
export function OrganizerPanel({
  email,
}: OrganizerPanelProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "circuitos" | "reagendar" | null
  >(null);
  const [view, setView] = useState<"panel" | "public">("panel");

  // Reactive clock for the counters card (recomputes every 30s)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { state: liveState, loading, error: liveStateError, refetch } = useLiveState();
  const nextMatch = liveState?.nextMatch ?? null;
  const isCancelled = !!liveState?.etapa?.cancelledAt;
  // Bell notice: only a match whose teams are already defined can be loaded.
  const pendingNotice =
    nextMatch && nextMatch.teamA && nextMatch.teamB ? nextMatch : null;

  // Closing is irreversible and only allowed once the FINAL has a result.
  const closeState = closeEtapaUi(liveState?.etapa, liveState?.brackets);

  const [closingEtapa, setClosingEtapa] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  async function handleCloseEtapa() {
    const etapaId = liveState?.etapaId;
    if (!etapaId) return;
    setClosingEtapa(true);
    setCloseMsg(null);
    try {
      await closeEtapa(etapaId);
      await refetch();
      setCloseConfirmOpen(false);
    } catch (err) {
      setCloseMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setClosingEtapa(false);
    }
  }

  // resultStatus is not part of state.schedule rows; join it from brackets.
  const resultStatusById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of liveState?.brackets ?? []) {
      map.set(m.id, m.resultStatus);
    }
    return map;
  }, [liveState?.brackets]);

  const sections = isCancelled ? SECTIONS_CANCELLED : SECTIONS_DEFAULT;

  function handleSectionClick(label: string) {
    switch (label) {
      case "Equipos":
        setActiveSection("circuitos");
        break;
      case "Agenda de partidos":
        setActiveSection("reagendar");
        break;
      default:
        setActiveSection(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Silently proceed — clear cookie via hard nav fallback
    } finally {
      setLoggingOut(false);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/organizador";
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/90 backdrop-blur ring-1 ring-inset ring-sand-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-stone-900">
              Panel organizador
            </h1>
            <span className="text-xs text-stone-400 mt-0.5">{email}</span>
          </div>
          <div className="flex items-center gap-2">
            {view === "panel" ? (
              <>
                <button
                  onClick={() => setView("public")}
                  className="rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-xs font-semibold text-stone-700 ring-1 ring-inset ring-sand-200 hover:bg-sand-100 transition-colors min-h-[44px]"
                >
                  👁 Ver página
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  {loggingOut ? "Cerrando…" : "Cerrar sesión"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setView("panel")}
                className="rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-xs font-semibold text-stone-700 ring-1 ring-inset ring-sand-200 hover:bg-sand-100 transition-colors min-h-[44px]"
              >
                ← Volver al panel
              </button>
            )}
          </div>
        </div>
      </header>

{view === "panel" ? (
    <>
      {!isCancelled && <PendingNotice match={pendingNotice} />}
      {!isCancelled && (
        <>
          <CloseEtapaBanner
            uiState={closeState}
            busy={closingEtapa}
            message={closeMsg}
            onRequestClose={() => {
              setCloseMsg(null);
              setCloseConfirmOpen(true);
            }}
          />
          {closeConfirmOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Finalizar etapa"
            >
              <div className="w-full max-w-md rounded-2xl border border-sand-300 bg-white p-6 shadow-xl">
                <h3 className="text-base font-semibold text-stone-900">
                  Finalizar {liveState?.etapa?.name ?? "la etapa"}
                </h3>
                <p className="mt-2 text-sm text-stone-600">
                  Se cierra el circuito con el resultado de la final.{" "}
                  <strong>No se puede deshacer</strong>: después no vas a poder
                  cargar ni editar más resultados.
                </p>
                {closeMsg && (
                  <p
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                    role="alert"
                  >
                    {closeMsg}
                  </p>
                )}
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCloseConfirmOpen(false)}
                    disabled={closingEtapa}
                    className="rounded-lg border border-sand-300 bg-sand-50 px-4 py-2.5 text-xs font-semibold text-stone-700 ring-1 ring-inset ring-sand-200 hover:bg-sand-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseEtapa}
                    disabled={closingEtapa}
                    className="rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    {closingEtapa ? "Cerrando…" : "Sí, finalizar etapa"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <TimeCountersCard
        nowMs={nowMs}
        schedule={liveState?.schedule ?? []}
        resultStatusById={resultStatusById}
        matchMinutes={liveState?.matchMinutes ?? 20}
      />
      {activeSection === "circuitos" ? (
        <CircuitosSection onBack={() => setActiveSection(null)} />
      ) : activeSection === "reagendar" ? (
        <ReagendarSection onBack={() => setActiveSection(null)} />
      ) : (
        /* Sections list */
        <main className="mx-auto w-full max-w-3xl px-6 py-8">
          <nav aria-label="Secciones del panel" className="flex flex-col gap-3">
            {sections.map((section) =>
              section.kind === "actionable" ? (
                <SectionCard
                  key={section.label}
                  label={section.label}
                  hint={section.hint}
                  onClick={() => handleSectionClick(section.label)}
                />
              ) : (
                <DisabledSectionCard
                  key={section.label}
                  label={section.label}
                  hint={section.hint}
                />
              )
            )}
            <ResultsCard
              state={liveState}
              loading={loading}
              error={liveStateError}
              refetch={refetch}
              disabled={isCancelled}
            />
            {!isCancelled && (
              <MejoresTercerosPanel state={liveState} refetch={refetch} />
            )}
          </nav>
        </main>
      )}
    </>
  ) : (
        /* Public view — embedded iframe (same-origin, session preserved) */
        <div className="flex-1 flex flex-col">
          <div className="mx-auto w-full max-w-3xl px-6 py-3">
            <span className="text-xs text-stone-500">
              Vista previa pública — misma sesión
            </span>
          </div>
          <iframe
            src="/?preview=1"
            className="flex-1 w-full border-0"
            title="Vista previa de la página pública"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>
      )}
    </div>
  );
}

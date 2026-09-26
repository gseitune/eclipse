"use client";

import { logout } from "@/lib/front/api";
import { useState } from "react";
import { useLiveState } from "@/lib/front/use-live-state";
import { setWins } from "@/lib/front/types";
import type { MatchPublic } from "@/lib/front/types";
import { ResultadosSection } from "./ResultadosSection";
import { CircuitosSection } from "./CircuitosSection";

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

/* ── Section kind ── */
type SectionKind = "actionable" | "disabled";

interface SectionConfig {
  readonly label: string;
  readonly hint: string;
  readonly kind: SectionKind;
}

const SECTIONS: readonly SectionConfig[] = [
  {
    label: "Equipos",
    hint: "Alta, baja y estado de equipos — Próximamente",
    kind: "disabled",
  },
  {
    label: "Circuitos y etapas",
    hint: "Crear y editar circuitos y etapas",
    kind: "actionable",
  },
  {
    label: "Reagendar partidos",
    hint: "Reagendar partidos — Próximamente",
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

/* ── Subcomponent: Results scoreboard card (live match, replaces block button) ── */
function ResultsScoreboardCard({
  match,
  loading,
  onOpen,
}: {
  readonly match: MatchPublic | null;
  readonly loading: boolean;
  readonly onOpen: () => void;
}) {
  const wins = match ? setWins(match.sets) : { a: 0, b: 0 };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-xl border border-sand-300 bg-sand-50 px-5 py-5 text-left ring-1 ring-inset ring-sand-200 hover:bg-sand-100 hover:ring-sand-300 transition-colors min-h-[44px]"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-base font-bold text-stone-900">
          Resultados
        </span>
        <span className="mt-0.5 block text-xs text-stone-500">
          Cargar o corregir resultados
        </span>

        {/* Live board */}
        {match ? (
          <span className="mt-4 flex items-center gap-4 rounded-lg border border-sand-300 bg-white px-5 py-5">
            <span className="flex-1 truncate text-base font-semibold text-stone-900 text-right">
              {match.teamA?.name ?? "?"}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="w-12 text-center text-4xl font-bold text-stone-900">
                {wins.a}
              </span>
              <span className="text-xl font-bold text-stone-400">:</span>
              <span className="w-12 text-center text-4xl font-bold text-stone-900">
                {wins.b}
              </span>
            </span>
            <span className="flex-1 truncate text-base font-semibold text-stone-900 text-left">
              {match.teamB?.name ?? "?"}
            </span>
          </span>
        ) : (
          <span className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-sand-200 bg-stone-100/70 px-4 py-6 text-stone-400">
            <LockIcon />
            <span className="text-sm font-medium">
              {loading ? "Cargando…" : "Sin partido activo"}
            </span>
          </span>
        )}
      </span>
      <span className="text-sunset-500 text-sm font-medium flex-shrink-0 self-center">
        →
      </span>
    </button>
  );
}

/* ── Main panel ── */
export function OrganizerPanel({
  email,
}: OrganizerPanelProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "resultados" | "circuitos" | null
  >(null);
  const [view, setView] = useState<"panel" | "public">("panel");

  const { state: liveState, loading } = useLiveState();
  const nextMatch = liveState?.nextMatch ?? null;

  function handleSectionClick(label: string) {
    switch (label) {
      case "Resultados":
        setActiveSection("resultados");
        break;
      case "Circuitos y etapas":
        setActiveSection("circuitos");
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
        activeSection === "resultados" ? (
          <ResultadosSection onBack={() => setActiveSection(null)} />
        ) : activeSection === "circuitos" ? (
          <CircuitosSection onBack={() => setActiveSection(null)} />
        ) : (
          /* Sections list */
          <main className="mx-auto w-full max-w-3xl px-6 py-8">
            <nav aria-label="Secciones del panel" className="flex flex-col gap-3">
              {SECTIONS.map((section) =>
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
              <ResultsScoreboardCard
                match={nextMatch}
                loading={loading}
                onOpen={() => setActiveSection("resultados")}
              />
            </nav>
          </main>
        )
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

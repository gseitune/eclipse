"use client";

import { useState, useEffect } from "react";
import { fetchEtapas, createEtapa } from "@/lib/front/api";
import type { EtapaMeta } from "@/lib/front/types";
import { ApiError } from "@/lib/front/types";

function formatDateEs(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ── Props ── */
export interface CircuitosSectionProps {
  readonly onBack: () => void;
}

export function CircuitosSection({ onBack }: CircuitosSectionProps) {
  const [etapas, setEtapas] = useState<EtapaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [nombre, setNombre] = useState("");
  const [equipos, setEquipos] = useState<TeamRow[]>([]);

  interface TeamRow {
    maleName: string;
    femaleName: string;
  }

  // Etapa numbers allowed: 1..8, starting after the last existing one
  const ETAPA_MIN = 1;
  const ETAPA_MAX = 8;
  const existingNumbers = new Set(
    etapas
      .map((etapa) => {
        const m = /^Etapa\s+(\d+)$/.exec(etapa.name.trim());
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null),
  );
  const lastNumber =
    existingNumbers.size > 0 ? Math.max(...existingNumbers) : ETAPA_MIN - 1;
  const availableNumbers = Array.from(
    { length: ETAPA_MAX - lastNumber },
    (_, i) => lastNumber + 1 + i,
  ).filter((n) => n >= ETAPA_MIN && n <= ETAPA_MAX);

  function updateEquipo(index: number, patch: Partial<TeamRow>) {
    setEquipos((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  // Team name comes from the fixed mixed pair: "male / female"
  const deriveTeamName = (row: TeamRow) =>
    `${row.maleName.trim()} / ${row.femaleName.trim()}`;

  const allRowsFilled =
    equipos.length > 0 &&
    equipos.every((row) => row.maleName.trim() && row.femaleName.trim());

  // Load data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const etapasResp = await fetchEtapas();
        if (!cancelled) {
          setEtapas(etapasResp.etapas);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : String(err);
          setSubmitMsg(msg);
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

  // Create etapa
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitMsg(null);
    if (!nombre || !allRowsFilled) return;
    setSubmitting(true);
    try {
      await createEtapa({
        name: nombre,
        teams: equipos.map((row) => ({
          name: deriveTeamName(row),
          maleName: row.maleName.trim(),
          femaleName: row.femaleName.trim(),
        })),
      });
      // Reload list
      const resp = await fetchEtapas();
      setEtapas(resp.etapas);
      // Clear form
      setNombre("");
      setEquipos([]);
      setSubmitMsg("Etapa creada");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setSubmitMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Closing an etapa is only done programmatically (no UI action).
  // It cannot be undone once closed.

  if (loading) {
    return (
      <div className="flex flex-col">
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
          <h2 className="text-lg font-semibold text-stone-900">
            Creador de equipos
          </h2>
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
        <h2 className="text-lg font-semibold text-stone-900">
          Creador de equipos
        </h2>
      </div>

      {/* Create form */}
      <section aria-label="Crear etapa" className="mb-8">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Crear etapa
        </h3>
        <form onSubmit={handleCreate} className="rounded-xl border border-sand-200 bg-sand-50 p-5 space-y-4">
          <div>
            <label htmlFor="circuito-nombre" className="block text-xs font-medium text-stone-600 mb-1">
              Número del circuito (Etapa)
            </label>
            <select
              id="circuito-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={submitting || availableNumbers.length === 0}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
            >
              <option value="" disabled>
                {availableNumbers.length === 0
                  ? "No hay etapas disponibles"
                  : "Elegí el número de etapa"}
              </option>
              {availableNumbers.map((n) => (
                <option key={n} value={`Etapa ${n}`}>
                  Etapa {n}
                </option>
              ))}
            </select>
            {availableNumbers.length === 0 && (
              <p className="mt-1 text-xs text-stone-400">
                Se alcanzó el máximo de 8 etapas.
              </p>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-stone-600 mb-1">
              Equipos — mixto fijo: un jugador masculino y una jugadora femenina por equipo
            </span>
            {equipos.length === 0 ? (
              <p className="text-sm text-stone-400 mb-2">
                Todavía no hay equipos cargados.
              </p>
            ) : (
              <ul className="space-y-3 mb-2">
                {equipos.map((row, index) => (
                  <li
                    key={index}
                    className="rounded-lg border border-sand-200 bg-white p-3 space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        aria-label={`Jugador masculino ${index + 1}`}
                        value={row.maleName}
                        onChange={(e) => updateEquipo(index, { maleName: e.target.value })}
                        disabled={submitting}
                        placeholder="Jugador masculino"
                        className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                      />
                      <input
                        type="text"
                        aria-label={`Jugadora femenina ${index + 1}`}
                        value={row.femaleName}
                        onChange={(e) => updateEquipo(index, { femaleName: e.target.value })}
                        disabled={submitting}
                        placeholder="Jugadora femenina"
                        className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEquipos((rows) => rows.filter((_, i) => i !== index))
                      }
                      disabled={submitting}
                      className="text-xs font-medium text-stone-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() =>
                setEquipos((rows) => [
                  ...rows,
                  { maleName: "", femaleName: "" },
                ])
              }
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-sand-50 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              + Agregar equipo
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting || !nombre || !allRowsFilled}
            className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {submitting ? "Creando…" : "Crear etapa"}
          </button>
        </form>
      </section>

      {/* Submit messages */}
      {submitMsg && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            submitMsg.includes("creada") || submitMsg.includes("cerrado")
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
          role="alert"
        >
          {submitMsg}
        </div>
      )}

      {/* Etapa list */}
      <section aria-label="Lista de etapas">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Etapas ({etapas.length})
        </h3>
        {etapas.length === 0 ? (
          <p className="text-sm text-stone-400">
            Aún no hay etapas creadas.
          </p>
        ) : (
          <ul className="space-y-3">
            {etapas.map((etapa) => (
              <li
                key={etapa.id}
                className="flex items-center justify-between rounded-xl border border-sand-200 bg-white/40 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-stone-900">
                    {etapa.name}
                  </span>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                    <span>{formatDateEs(etapa.date)}</span>
                    <span>·</span>
                    <span>{etapa.teamCount} equipos</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

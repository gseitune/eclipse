"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchEtapas, createEtapa, createCancelledEtapa, cancelEtapa, updateEtapa, deleteEtapa } from "@/lib/front/api";
import type { BracketFormat, Circuit, EtapaMeta, EtapaSetFormat } from "@/lib/front/types";
import { availableEtapaNumbers } from "@/lib/front/etapa-numbers";
import { ApiError } from "@/lib/front/types";

function formatDateEs(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    // The etapa date is a calendar day, stored at UTC midnight: formatting it in
    // the browser's timezone would show the previous day west of UTC.
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

/** Today as the value a `<input type="date">` expects, in local time. */
function todayInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/* ── Props ── */
export interface CircuitosSectionProps {
  readonly onBack: () => void;
  /** Circuit (annual season) the organizer is working on. */
  readonly circuit: Circuit;
  readonly onCircuitChange: (circuit: Circuit) => void;
}

export function CircuitosSection({
  onBack,
  circuit,
  onCircuitChange,
}: CircuitosSectionProps) {
  const [etapas, setEtapas] = useState<EtapaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<EtapaMeta | null>(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Delete (a cancelled etapa only) modal state
  const [deleteTarget, setDeleteTarget] = useState<EtapaMeta | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit (name/date) modal state — only for open, unplayed etapas
  const [editTarget, setEditTarget] = useState<EtapaMeta | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Form state
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(() => todayInput());
  const [equipos, setEquipos] = useState<TeamRow[]>([]);
  const [formato, setFormato] = useState<BracketFormat>("STANDARD");
  // "STAGE" keeps the per-stage convention (groups 21, semis 2x15, final
  // best-of-3) used by the etapas created before the choice existed.
  const [formatoSet, setFormatoSet] = useState<EtapaSetFormat | "STAGE">(
    circuit === "INTERMEDIOS" ? "TWO_21_TIEBREAK_15" : "STAGE",
  );

  interface TeamRow {
    maleName: string;
    femaleName: string;
  }

  // The valid bracket formats depend on the team count: 6-10 teams split into
  // 2 zones (direct semis or repechaje); 11-12 split into 3 zones (direct semis
  // or quarterfinals). Nothing else is offered, so no invalid combination can
  // be picked and then rejected by the back.
  const threeZones = equipos.length >= 11;
  const validFormats: BracketFormat[] = threeZones
    ? ["STANDARD", "CUARTOS"]
    : ["STANDARD", "REPECHAJE"];
  // Derived instead of synced in an effect: a format that stops being valid
  // falls back to direct semis on its own when the team count changes.
  const effectiveFormato: BracketFormat = validFormats.includes(formato)
    ? formato
    : "STANDARD";

  function formatLabel(value: BracketFormat): string {
    if (value === "REPECHAJE") return "Con repechaje (2.º y 3.º juegan su pase)";
    if (value === "CUARTOS") return "Cuartos de final (clasifican 8)";
    return threeZones
      ? "Semifinales directas: tres primeros + mejor segundo"
      : "Semifinales directas: 1.º y 2.º de cada zona";
  }

  // Etapa numbers come from the gaps of this circuit: a skipped number can be
  // loaded later (only 6 loaded → 1,2,3,4,5,7,8 are offered).
  const availableNumbers = availableEtapaNumbers(etapas.map((etapa) => etapa.name));

  // The number in the name is the identity of the etapa inside the circuit, so
  // the list reads 1,2,3… even when a gap is filled after the last one.
  const etapasPorNumero = useMemo(() => {
    const numero = (name: string) => {
      const match = /^Etapa\s+(\d+)$/.exec(name.trim());
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };
    return [...etapas].sort((a, b) => numero(a.name) - numero(b.name));
  }, [etapas]);

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

  // Load data — the list belongs to the selected circuit (annual season).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const etapasResp = await fetchEtapas(circuit);
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
  }, [circuit]);

  // The section is remounted on circuit change (key={circuit} in the panel), so
  // the form, the numbering list and the format default start clean.
  function handleCircuitChange(next: Circuit) {
    onCircuitChange(next);
  }

  // Create etapa
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitMsg(null);
    if (!nombre || !fecha || !allRowsFilled) return;
    setSubmitting(true);
    try {
      await createEtapa({
        name: nombre,
        date: fecha,
        bracketFormat: effectiveFormato,
        circuit,
        setFormat: formatoSet === "STAGE" ? null : formatoSet,
        teams: equipos.map((row) => ({
          name: deriveTeamName(row),
          maleName: row.maleName.trim(),
          femaleName: row.femaleName.trim(),
        })),
      });
      // Reload list
      const resp = await fetchEtapas(circuit);
      setEtapas(resp.etapas);
      // Clear form
      setNombre("");
      setFecha(todayInput());
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

  // Reload the etapa list (used after create and cancel)
  async function reloadEtapas() {
    const resp = await fetchEtapas();
    setEtapas(resp.etapas);
  }

  // A fecha suspended by weather: only number and date, no roster at all.
  async function handleCreateCancelled() {
    if (!nombre || !fecha) return;
    setSubmitMsg(null);
    setSubmitting(true);
    try {
      await createCancelledEtapa({ name: nombre, date: fecha, circuit });
      await reloadEtapas();
      setNombre("");
      setFecha(todayInput());
      setEquipos([]);
      setSubmitMsg("Etapa cancelada registrada");
    } catch (err) {
      setSubmitMsg(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Delete a cancelled etapa: its number becomes available again.
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      await deleteEtapa(deleteTarget.id);
      setDeleteTarget(null);
      await reloadEtapas();
      setSubmitMsg("Etapa eliminada");
    } catch (err) {
      setDeleteMsg(err instanceof ApiError ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  // Cancel an etapa (weather suspension) after password confirmation
  function openCancelModal(etapa: EtapaMeta) {
    setCancelTarget(etapa);
    setCancelPassword("");
    setCancelMsg(null);
  }

  function closeCancelModal() {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelPassword("");
    setCancelMsg(null);
  }

  async function handleCancelConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelTarget || !cancelPassword) return;
    setCancelling(true);
    setCancelMsg(null);
    try {
      await cancelEtapa(cancelTarget.id, cancelPassword);
      await reloadEtapas();
      setCancelTarget(null);
      setCancelPassword("");
      setSubmitMsg("Etapa cancelada");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setCancelMsg(msg);
    } finally {
      setCancelling(false);
    }
  }

  // An etapa's name/date can only be edited while it is open and unplayed:
  // once the first result is loaded the fixture and the roster are frozen.
  function isEtapaEditable(etapa: EtapaMeta): boolean {
    return !etapa.cancelledAt && !etapa.closedAt && !etapa.played;
  }

  function openEditModal(etapa: EtapaMeta) {
    setEditTarget(etapa);
    setEditName(etapa.name);
    setEditDate(etapa.date ? etapa.date.slice(0, 10) : "");
    setEditMsg(null);
  }

  function closeEditModal() {
    if (editing) return;
    setEditTarget(null);
    setEditName("");
    setEditDate("");
    setEditMsg(null);
  }

  async function handleEditConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) {
      setEditMsg("El nombre es obligatorio.");
      return;
    }
    setEditing(true);
    setEditMsg(null);
    try {
      await updateEtapa(editTarget.id, { name, date: editDate || null });
      await reloadEtapas();
      setEditTarget(null);
      setSubmitMsg("Etapa actualizada");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setEditMsg(msg);
    } finally {
      setEditing(false);
    }
  }

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
            Crear Etapa
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
          Crear Etapa
        </h2>
      </div>

      {/* Create form */}
      <section aria-label="Crear etapa" className="mb-8">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Crear Etapa
        </h3>
        <form onSubmit={handleCreate} className="rounded-xl border border-sand-200 bg-sand-50 p-5 space-y-4">
          <div>
            <label htmlFor="circuito-tipo" className="block text-xs font-medium text-stone-600 mb-1">
              Circuito
            </label>
            <select
              id="circuito-tipo"
              value={circuit}
              onChange={(e) => handleCircuitChange(e.target.value as Circuit)}
              disabled={submitting}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
            >
              <option value="PRINCIPIANTES">Principiantes</option>
              <option value="INTERMEDIOS">Intermedios</option>
            </select>
            <p className="mt-1 text-xs text-stone-400">
              Cada circuito tiene su propia numeración y su propia tabla anual.
            </p>
          </div>
          <div>
            <label htmlFor="circuito-fecha" className="block text-xs font-medium text-stone-600 mb-1">
              Fecha de la etapa
            </label>
            <input
              id="circuito-fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
            />
            <p className="mt-1 text-xs text-stone-400">
              Ordena el circuito: la etapa más reciente es la que se muestra
              como actual.
            </p>
          </div>
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
            <label
              htmlFor="circuito-formato"
              className="block text-xs font-medium text-stone-600 mb-1"
            >
              Formato
            </label>
            <select
              id="circuito-formato"
              value={effectiveFormato}
              onChange={(e) => setFormato(e.target.value as BracketFormat)}
              disabled={submitting}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
            >
              {validFormats.map((value) => (
                <option key={value} value={value}>
                  {formatLabel(value)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-400">
              El partido por el tercer puesto se juega siempre.
            </p>
          </div>
          <div>
            <label
              htmlFor="circuito-formato-set"
              className="block text-xs font-medium text-stone-600 mb-1"
            >
              Formato de los partidos
            </label>
            <select
              id="circuito-formato-set"
              value={formatoSet}
              onChange={(e) =>
                setFormatoSet(e.target.value as EtapaSetFormat | "STAGE")
              }
              disabled={submitting}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
            >
              <option value="STAGE">
                Por instancia (zonas a 21, semis 2×15, final mejor de 3)
              </option>
              <option value="SINGLE_21">1 set a 21</option>
              <option value="TWO_21_TIEBREAK_15">
                2 sets a 21 (tercer set a 15 si quedan 1-1)
              </option>
            </select>
            <p className="mt-1 text-xs text-stone-400">
              El formato elegido se aplica a todos los partidos de la etapa,
              incluida la final.
            </p>
          </div>
          <div>
            <span className="block text-xs font-medium text-stone-600 mb-1">
              Crear Etapa — mixto fijo: un jugador masculino y una jugadora femenina por equipo
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
            <p className="mt-2 text-xs text-stone-500">
              {equipos.length} {equipos.length === 1 ? "equipo" : "equipos"}
              {equipos.length > 0 &&
                ` · ${threeZones ? "3 zonas" : "2 zonas"}`}
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || !nombre || !fecha || !allRowsFilled}
            className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {submitting ? "Creando…" : "Crear etapa"}
          </button>
          <button
            type="button"
            onClick={handleCreateCancelled}
            disabled={submitting || !nombre || !fecha}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            🚫 Registrar etapa cancelada por clima
          </button>
          <p className="text-center text-xs text-stone-400">
            Una etapa cancelada por clima se registra solo con número y fecha: no
            necesita equipos ni genera fixture.
          </p>
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
            {etapasPorNumero.map((etapa) => (
              <li
                key={etapa.id}
                className="flex items-center justify-between rounded-xl border border-sand-200 bg-white/40 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">
                      {etapa.name}
                    </span>
                    {etapa.cancelledAt && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200">
                        Cancelada
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                    <span>{formatDateEs(etapa.date)}</span>
                    <span>·</span>
                    <span>{etapa.teamCount} equipos</span>
                  </div>
                </div>
                {!etapa.cancelledAt && (
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    {isEtapaEditable(etapa) && (
                      <button
                        type="button"
                        onClick={() => openEditModal(etapa)}
                        className="rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-sand-100 transition-colors min-h-[44px]"
                      >
                        ✏️ Editar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openCancelModal(etapa)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors min-h-[44px]"
                    >
                      🚫 Cancelar fecha
                    </button>
                  </div>
                )}
                {etapa.cancelledAt && (
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteMsg(null);
                        setDeleteTarget(etapa);
                      }}
                      className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors min-h-[44px]"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Edit-etapa modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Editar etapa"
        >
          <div className="w-full max-w-md rounded-2xl border border-sand-300 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Editar {editTarget.name}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Sólo se editan el nombre y la fecha. Los equipos de la etapa no se
              modifican: sólo cambian entre etapas.
            </p>
            <form onSubmit={handleEditConfirm} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Nombre de la etapa
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={editing}
                  className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-date"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Fecha
                </label>
                <input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={editing}
                  className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                />
              </div>
              {editMsg && (
                <p
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 border border-red-200"
                  role="alert"
                >
                  {editMsg}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editing}
                  className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-50 transition-colors min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={editing || !editName.trim()}
                  className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  {editing ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete-etapa modal (cancelled etapas only) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Eliminar etapa"
        >
          <div className="w-full max-w-md rounded-2xl border border-sand-300 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Eliminar {deleteTarget.name}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Se borra la etapa cancelada con sus equipos y partidos, y el número
              vuelve a quedar disponible. <strong>No se puede deshacer.</strong>
            </p>
            {deleteMsg && (
              <p
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 border border-red-200"
                role="alert"
              >
                {deleteMsg}
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-50 transition-colors min-h-[44px]"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel-etapa modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cancelar etapa"
        >
          <div className="w-full max-w-md rounded-2xl border border-sand-300 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Cancelar {cancelTarget.name}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Se cancela la fecha de la etapa. No se borran datos.
            </p>
            <form onSubmit={handleCancelConfirm} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="cancel-password"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Contraseña del organizador
                </label>
                <input
                  id="cancel-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={cancelPassword}
                  onChange={(e) => setCancelPassword(e.target.value)}
                  disabled={cancelling}
                  className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                />
              </div>
              {cancelMsg && (
                <p
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 border border-red-200"
                  role="alert"
                >
                  {cancelMsg}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCancelModal}
                  disabled={cancelling}
                  className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-50 transition-colors min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={cancelling || !cancelPassword}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  {cancelling ? "Cancelando…" : "Confirmar cancelación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

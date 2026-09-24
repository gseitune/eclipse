"use client";

import { useState, useCallback, useMemo } from "react";
import { useLiveState } from "../../lib/front/use-live-state";
import {
  zonificationGenerate,
  zonificationSwap,
  zonificationConfirm,
} from "../../lib/front/api";
import type { ZoneId, TeamPublic } from "../../lib/front/types";
import { ApiError } from "../../lib/front/types";
import { zoneName } from "../../lib/front/phase";

/* ── Props ── */
export interface ZonificacionSectionProps {
  readonly onBack: () => void;
}

/* ── Swap icon (inline SVG, no emoji) ── */
function SwapIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5 flex-shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
    </svg>
  );
}

/* ── Confirmed badge (inline SVG, no emoji) ── */
function ConfirmedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-300">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
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
      Zonas confirmadas
    </span>
  );
}

/* ── Helper: zones that have at least one team ── */
function zonesWithTeams(
  zones: Record<ZoneId, TeamPublic[]>,
): Array<{ zone: ZoneId; teams: TeamPublic[] }> {
  return (Object.keys(zones) as ZoneId[]).flatMap((zone) => {
    const teams = zones[zone];
    return teams.length > 0 ? [{ zone, teams }] : [];
  });
}

/* ── Helper: total team count across zones ── */
function totalTeamCount(zones: Record<ZoneId, TeamPublic[]>): number {
  return Object.values(zones).reduce(
    (sum, teams) => sum + teams.length,
    0,
  );
}

/* ── Main component ── */
export function ZonificacionSection({ onBack }: ZonificacionSectionProps) {
  const { state, loading, error, refetch } = useLiveState();

  const [selectedTeam, setSelectedTeam] = useState<{
    id: string;
    name: string;
    zone: ZoneId;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const zones: Record<ZoneId, TeamPublic[]> = useMemo(
    () => state?.zones ?? { A: [], B: [], C: [] },
    [state?.zones],
  );
  const zoneConfirmed = state?.zoneConfirmed ?? false;
  const zonesWithData = useMemo(() => zonesWithTeams(zones), [zones]);
  const hasTeams = totalTeamCount(zones) > 0;

  // ── Generate zones ──
  const handleGenerate = useCallback(async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await zonificationGenerate();
      await refetch();
      setSelectedTeam(null);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 409:
            setSubmitMsg("Las zonas ya fueron confirmadas.");
            break;
          case 400:
            setSubmitMsg(
              "Se necesitan al menos 6 equipos para armar zonas.",
            );
            break;
          case 401:
            setSubmitMsg(
              "Sesión vencida. Volvé a iniciar sesión.",
            );
            break;
          default:
            setSubmitMsg("Error al actualizar la zonificación.");
        }
      } else {
        setSubmitMsg("Error al actualizar la zonificación.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [refetch]);

  // ── Confirm zones ──
  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await zonificationConfirm();
      await refetch();
      setSelectedTeam(null);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 409:
            setSubmitMsg("Las zonas ya fueron confirmadas.");
            break;
          case 401:
            setSubmitMsg(
              "Sesión vencida. Volvé a iniciar sesión.",
            );
            break;
          default:
            setSubmitMsg("Error al actualizar la zonificación.");
        }
      } else {
        setSubmitMsg("Error al actualizar la zonificación.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [refetch]);

  // ── Swap team ──
  const handleSwap = useCallback(
    async (teamId: string, from: ZoneId, to: ZoneId) => {
      setSubmitting(true);
      setSubmitMsg(null);
      try {
        await zonificationSwap(teamId, from, to);
        await refetch();
        setSelectedTeam(null);
      } catch (err) {
        if (err instanceof ApiError) {
          switch (err.status) {
            case 409:
              setSubmitMsg("Las zonas ya fueron confirmadas.");
              break;
            case 400:
              setSubmitMsg(
                "Se necesitan al menos 6 equipos para armar zonas.",
              );
              break;
            case 401:
              setSubmitMsg(
                "Sesión vencida. Volvé a iniciar sesión.",
              );
              break;
            default:
              setSubmitMsg("Error al actualizar la zonificación.");
          }
        } else {
          setSubmitMsg("Error al actualizar la zonificación.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [refetch],
  );

  // ── Select / deselect team as swap source ──
  const selectTeam = useCallback(
    (team: TeamPublic) => {
      setSelectedTeam((prev) => {
        if (prev?.id === team.id && prev.zone === team.zone) {
          return null; // deselect
        }
        return { id: team.id, name: team.name, zone: team.zone };
      });
      setSubmitMsg(null);
    },
    [],
  );

  // ── Render: LOCKED view ──
  if (zoneConfirmed) {
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
          <h2 className="text-lg font-semibold text-stone-900">
            Zonificación
          </h2>
          <ConfirmedBadge />
        </div>

        {/* Locked zones display */}
        <div className="space-y-4 mb-6">
          {zonesWithData.map(({ zone, teams }) => (
            <div
              key={zone}
              className="rounded-xl border border-sand-300 bg-sand-50 p-5"
            >
              <h3 className="text-sm font-semibold text-stone-900 mb-3">
                {zoneName(zone)}
                <span className="ml-2 text-xs text-stone-400 font-normal">
                  ({teams.length} equipo{teams.length !== 1 ? "s" : ""})
                </span>
              </h3>
              <ul className="space-y-2">
                {teams.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-center gap-2 text-sm text-stone-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sunset-400 flex-shrink-0" />
                    {team.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Locked message */}
        <div className="rounded-lg bg-sand-100 border border-sand-200 px-4 py-3 text-sm text-stone-600">
          La zonificación está confirmada. El fixture ya se generó.
        </div>

        {/* Loading / error feedback */}
        {loading && (
          <p className="text-xs text-stone-400 mt-4">Actualizando…</p>
        )}
        {error && !submitMsg && (
          <p className="text-xs text-red-500 mt-4">{error}</p>
        )}
      </div>
    );
  }

  // ── Render: REVIEW mode (not confirmed) ──
  const canAct = !submitting;

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
        <h2 className="text-lg font-semibold text-stone-900">Zonificación</h2>
      </div>

      {/* ── Empty state: no teams at all ── */}
      {!hasTeams ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-sand-100 border border-sand-200 px-4 py-3 text-sm text-stone-500">
            Se necesitan al menos 6 equipos.
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting}
            className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {submitting ? "Generando…" : "Generar zonas"}
          </button>
        </div>
      ) : (
        <>
          {/* ── Zone cards ── */}
          <div className="space-y-4 mb-6">
            {zonesWithData.map(({ zone, teams }) => (
              <div
                key={zone}
                className={`rounded-xl border p-5 transition-colors ${
                  selectedTeam
                    ? "border-sand-300 bg-sand-50"
                    : "border-sand-200 bg-sand-50"
                }`}
              >
                {/* Zone header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-stone-900">
                    {zoneName(zone)}
                    <span className="ml-2 text-xs text-stone-400 font-normal">
                      ({teams.length})
                    </span>
                  </h3>
                  {/* Drop target indicator when a team is selected */}
                  {selectedTeam && selectedTeam.zone !== zone && (
                    <span className="text-xs text-green-600 font-medium">
                      Mover acá
                    </span>
                  )}
                </div>

                {/* Team rows */}
                <ul className="space-y-2">
                  {teams.map((team) => {
                    const isSelected =
                      selectedTeam?.id === team.id &&
                      selectedTeam?.zone === team.zone;
                    const isOtherSelected =
                      selectedTeam !== null && !isSelected;

                    return (
                      <li key={team.id}>
                        <button
                          type="button"
                          onClick={() => selectTeam(team)}
                          disabled={!canAct}
                          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors min-h-[44px] ${
                            isSelected
                              ? "border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-200"
                              : isOtherSelected
                                ? "border-sand-200 bg-white text-stone-500 hover:border-sunset-300 hover:bg-sunset-50"
                                : "border-sand-200 bg-white text-stone-700 hover:border-sand-300 hover:bg-sand-100"
                          } disabled:opacity-50`}
                        >
                          <span className="flex-1 text-left font-medium">
                            {team.name}
                          </span>
                          <SwapIcon />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Drop target action: "Mover acá" button for the selected team */}
                {selectedTeam && selectedTeam.zone !== zone && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSwap(selectedTeam.id, selectedTeam.zone, zone)
                      }
                      disabled={submitting}
                      className="w-full rounded-lg border-2 border-green-300 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors min-h-[44px]"
                    >
                      Mover {selectedTeam.name} a{" "}
                      {zoneName(zone)}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Action buttons ── */}
          <div className="space-y-3">
            {/* Generate button (secondary) */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={submitting}
              className="w-full rounded-lg border border-sand-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-sand-50 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              {submitting ? "Generando…" : "Generar zonas"}
            </button>

            {/* Confirm button (primary) */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              Confirmar zonas
            </button>
          </div>

          {/* Hint */}
          <p className="text-xs text-stone-400 mt-3 text-center">
            Seleccá un equipo para moverlo de zona. Confirmá para generar el fixture.
          </p>
        </>
      )}

      {/* ── Submit messages ── */}
      {submitMsg && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${
            submitMsg.includes("confirmadas") || submitMsg.includes("cargado")
              ? "bg-green-50 text-green-700 border border-green-200"
              : submitMsg.includes("vencida")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-red-50 text-red-700 border border-red-200"
          }`}
          role="alert"
        >
          {submitMsg}
        </div>
      )}

      {/* Loading indicator */}
      {loading && !submitMsg && (
        <p className="text-xs text-stone-400 mt-3">Actualizando…</p>
      )}
      {error && !submitMsg && (
        <p className="text-xs text-red-500 mt-3">{error}</p>
      )}
    </div>
  );
}

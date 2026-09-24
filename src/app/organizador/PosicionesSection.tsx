"use client";

import { useState } from "react";
import { useLiveState } from "../../lib/front/use-live-state";
import { zoneName } from "../../lib/front/phase";
import type { ZoneId, StandingRow } from "../../lib/front/types";

const ZONES: ZoneId[] = ["A", "B", "C"];

/* ── Props ── */
export interface PosicionesSectionProps {
  readonly onBack: () => void;
}

/* ── Helper: zones that have standings rows ── */
function zonesWithStandings(
  standings: Partial<Record<ZoneId, StandingRow[]>>,
): ZoneId[] {
  return ZONES.filter((z) => (standings[z]?.length ?? 0) > 0);
}

/* ── Standings table for a single zone ── */
function ZoneStandingsTable({
  zone,
  rows,
}: {
  readonly zone: ZoneId;
  readonly rows: StandingRow[];
}) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white/60 p-3">
      {/* Zone header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-stone-800">
          {zoneName(zone)}
        </h3>
        <span className="inline-flex items-center justify-center rounded-full bg-sand-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-400">
          Sin equipos
        </p>
      ) : (
        <table className="w-full" aria-label={`Posiciones ${zoneName(zone)}`}>
          <thead>
            <tr className="border-b border-sand-200 text-xs text-stone-500">
              <th className="w-8 py-1 text-left font-semibold">#</th>
              <th className="py-1 text-left font-semibold">Equipo</th>
              <th className="py-1 text-right font-semibold">PJ</th>
              <th className="py-1 text-right font-semibold">PG</th>
              <th className="py-1 text-right font-semibold">PP</th>
              <th className="py-1 text-right font-semibold">DG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {rows.map((row, idx) => {
              const isLeader = idx === 0;

              return (
                <tr key={row.teamId}>
                  <td className="py-1.5">
                    <span
                      className={`font-bold ${
                        isLeader ? "text-amber-700" : "text-stone-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <span className="block truncate text-stone-800">
                      {row.teamName}
                    </span>
                    {row.unresolvedTie && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        desempate
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-sm text-stone-600">
                    {row.played}
                  </td>
                  <td className="py-1.5 text-right text-sm text-stone-600">
                    {row.won}
                  </td>
                  <td className="py-1.5 text-right text-sm text-stone-600">
                    {row.lost}
                  </td>
                  <td className="py-1.5 text-right text-sm text-stone-600">
                    {row.setDiff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Main component ── */
export function PosicionesSection({
  onBack,
}: PosicionesSectionProps) {
  const { state } = useLiveState();
  const [activeZone, setActiveZone] = useState<ZoneId>("A");

  const standings = state?.standings ?? {};

  // Only render zones that actually have standings rows
  const zoneList = zonesWithStandings(standings);
  const displayZones = zoneList.length > 0 ? zoneList : [];
  const shownZone = displayZones.includes(activeZone) ? activeZone : displayZones[0];

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
          Posiciones en vivo
        </h2>
      </div>

      {/* No standings yet */}
      {displayZones.length === 0 ? (
        <p className="mt-6 rounded-lg bg-sand-100 border border-sand-200 px-4 py-3 text-sm text-stone-500">
          Todavía no hay posiciones. Se generan cuando arranca el fixture.
        </p>
      ) : (
        <>
          {/* Mobile tabs */}
          <div className="mt-4 flex gap-2 sm:hidden">
            {displayZones.map((z) => {
              const isActive = z === shownZone;
              return (
                <button
                  key={z}
                  onClick={() => setActiveZone(z)}
                  className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-amber-700 text-white"
                      : "bg-sand-100 text-stone-700 hover:bg-sand-200"
                  }`}
                >
                  {zoneName(z)}
                </button>
              );
            })}
          </div>

          {/* Tables grid — 3-up on desktop, stacked on mobile */}
          <div
            className={`mt-4 grid grid-cols-1 gap-4 sm:gap-4 ${
              displayZones.length === 3
                ? "sm:grid-cols-3"
                : displayZones.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-1"
            }`}
          >
            {displayZones.map((z) => {
              const rows = standings[z] ?? [];
              const isMobileActive = z === shownZone;

              return (
                <div
                  key={z}
                  className={isMobileActive ? "" : "hidden sm:block"}
                >
                  <ZoneStandingsTable zone={z} rows={rows} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

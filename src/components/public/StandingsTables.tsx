"use client";

import { useState } from "react";
import { zoneName, phaseLabel } from "@/lib/front/phase";
import type { ZoneId, StandingRow, TeamPublic, StateSnapshot } from "@/lib/front/types";
import { TeamSheet } from "./TeamSheet";

const ZONES: ZoneId[] = ["A", "B", "C"];

interface StandingsTablesProps {
  standings: Partial<Record<ZoneId, StandingRow[]>>;
  zones: Record<ZoneId, TeamPublic[]>;
  liveIds: Set<string>;
  liveTeamIds: Set<string>;
  initialZone: ZoneId;
  phase: string;
  state: StateSnapshot | null;
}

export function StandingsTables({
  standings,
  zones,
  liveIds,
  liveTeamIds,
  initialZone,
  phase,
  state,
}: StandingsTablesProps) {
  const [activeZone, setActiveZone] = useState<ZoneId>(initialZone);
  const [openTeam, setOpenTeam] = useState<{ id: string; name: string; zone: string } | null>(null);

  // Only render zones that actually exist: a zone with teams or standings rows.
  // The back arms A+B for up to 10 teams and A+B+C above that, so C only shows
  // when the tournament really has three zones. Empty fallback keeps the
  // pre-fixture state visible without inventing a C zone.
  const zoneList: ZoneId[] = ZONES.filter(
    (z) => (zones[z]?.length ?? 0) > 0 || (standings[z]?.length ?? 0) > 0,
  );
  const displayZones = zoneList.length > 0 ? zoneList : (["A", "B"] as ZoneId[]);
  const shownZone = displayZones.includes(activeZone) ? activeZone : displayZones[0];

  function openTeamSheet(row: StandingRow) {
    setOpenTeam({ id: row.teamId, name: row.teamName, zone: row.zone });
  }

  function closeTeamSheet() {
    setOpenTeam(null);
  }

  return (
    <section aria-label="Posiciones" className="rounded-2xl border border-sand-300 bg-white/70 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">Posiciones</h2>
        {liveIds.size > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
            EN VIVO
          </span>
        )}
      </div>
      <p className="text-xs text-stone-400 mt-1">{phaseLabel(phase)}</p>

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

      {/* Tables grid */}
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
          const zoneTeams = zones[z] ?? [];
          const isMobileActive = z === shownZone;

          return (
            <div
              key={z}
              className={isMobileActive ? "" : "hidden sm:block"}
            >
              <div className="rounded-xl border border-sand-200 bg-white/60 p-3">
                {/* Zone header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-stone-800">
                    {zoneName(z)}
                  </h3>
                  <span className="inline-flex items-center justify-center rounded-full bg-sand-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
                    {zoneTeams.length}
                  </span>
                </div>

                {/* Empty state */}
                {rows.length === 0 && zoneTeams.length === 0 ? (
                  <p className="py-4 text-center text-sm text-stone-400">
                    Sin equipos
                  </p>
                ) : (
                  <table className="w-full" aria-label={`Posiciones ${zoneName(z)}`}>
                    <thead>
                      <tr className="border-b border-sand-200 text-xs text-stone-500">
                        <th className="w-8 py-1 text-left font-semibold">
                          #
                        </th>
                        <th className="py-1 text-left font-semibold">
                          Equipo
                        </th>
                        <th className="py-1 text-right font-semibold">
                          PJ
                        </th>
                        <th className="py-1 text-right font-semibold">
                          G
                        </th>
                        <th className="py-1 text-right font-semibold">
                          P
                        </th>
                        <th className="py-1 text-right font-semibold">
                          DG
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100">
                      {rows.map((row, idx) => {
                        const isLeader = idx === 0;
                        const isLive = liveTeamIds.has(row.teamId);

                        return (
                          <tr
                            key={row.teamId}
                            className={
                              isLive
                                ? "bg-sand-50"
                                : isLeader
                                  ? "bg-amber-50/40"
                                  : ""
                            }
                          >
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
                              <button
                                onClick={() => openTeamSheet(row)}
                                className="min-h-[44px] w-full text-left truncate text-stone-800 hover:text-amber-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 rounded"
                              >
                                <span className="block truncate">{row.teamName}</span>
                                {isLive && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-ember-500">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
                                    EN VIVO
                                  </span>
                                )}
                              </button>
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
            </div>
          );
        })}
      </div>

      {/* Team Sheet */}
      {openTeam && (
        <TeamSheet
          team={openTeam}
          onClose={closeTeamSheet}
          state={state}
          standingsRow={(() => {
            const rows = state?.standings[openTeam.zone as keyof typeof state.standings] ?? [];
            return rows.find((r) => r.teamId === openTeam.id) ?? null;
          })()}
          position={(() => {
            const rows = state?.standings[openTeam.zone as keyof typeof state.standings] ?? [];
            return rows.findIndex((r) => r.teamId === openTeam.id) + 1;
          })()}
        />
      )}
    </section>
  );
}

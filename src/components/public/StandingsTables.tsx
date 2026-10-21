"use client";

import { useState } from "react";
import { zoneName } from "@/lib/front/phase";
import type { ZoneId, StandingRow, TeamPublic } from "@/lib/front/types";

const ZONES: ZoneId[] = ["A", "B", "C"];

interface StandingsTablesProps {
  standings: Partial<Record<ZoneId, StandingRow[]>>;
  zones: Record<ZoneId, TeamPublic[]>;
  liveTeamIds: Set<string>;
  initialZone: ZoneId;
}

/**
 * Group-phase standings. Rendered as bare content: the surrounding card, the
 * title and the live badge live in TournamentTabs.
 */
export function StandingsTables({
  standings,
  zones,
  liveTeamIds,
  initialZone,
}: StandingsTablesProps) {
  const [activeZone, setActiveZone] = useState<ZoneId>(initialZone);

  // Only render zones that actually exist: a zone with teams or standings rows.
  // The back arms A+B for up to 10 teams and A+B+C above that, so C only shows
  // when the tournament really has three zones. Empty fallback keeps the
  // pre-fixture state visible without inventing a C zone.
  const zoneList: ZoneId[] = ZONES.filter(
    (z) => (zones[z]?.length ?? 0) > 0 || (standings[z]?.length ?? 0) > 0,
  );
  const displayZones = zoneList.length > 0 ? zoneList : (["A", "B"] as ZoneId[]);
  const shownZone = displayZones.includes(activeZone) ? activeZone : displayZones[0];

  return (
    <div>
      {/* Mobile tabs */}
      <div className="flex gap-2 sm:hidden">
        {displayZones.map((z) => {
          const isActive = z === shownZone;
          return (
            <button
              key={z}
              onClick={() => setActiveZone(z)}
              className={`min-h-[44px] flex-1 rounded-lg text-[15px] sm:text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sunset-600 ${
                isActive
                  ? "bg-tierra-900 text-sand-50"
                  : "bg-white/80 text-stone-600 hover:bg-white"
              }`}
            >
              {zoneName(z)}
            </button>
          );
        })}
      </div>

      {/* Tables grid */}
      <div
        className={`mt-4 grid grid-cols-1 gap-4 sm:mt-0 sm:gap-0 ${
          displayZones.length === 3
            ? "sm:grid-cols-3"
            : displayZones.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-1"
        }`}
      >
        {displayZones.map((z, zi) => {
          const rows = standings[z] ?? [];
          const zoneTeams = zones[z] ?? [];
          const isMobileActive = z === shownZone;

          return (
            <div
              key={z}
              className={`${isMobileActive ? "" : "hidden sm:block"} border-t border-sand-300/70 pt-4 sm:border-t-0 sm:pt-0 ${
                zi > 0 ? "sm:border-l sm:border-sand-300/70 sm:pl-7" : ""
              } ${zi < displayZones.length - 1 ? "sm:pr-7" : ""}`}
            >
              <div>
                {/* Zone header */}
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-[12px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                    {zoneName(z)}
                  </h3>
                  <span className="text-[13px] sm:text-xs text-stone-500">
                    {zoneTeams.length}{" "}
                    {zoneTeams.length === 1 ? "equipo" : "equipos"}
                  </span>
                </div>

                {/* Empty state */}
                {rows.length === 0 && zoneTeams.length === 0 ? (
                  <p className="py-4 text-center text-[15px] sm:text-sm text-stone-400">
                    Sin equipos
                  </p>
                ) : (
                  <table className="w-full" aria-label={`Posiciones ${zoneName(z)}`}>
                    <thead>
                      <tr className="border-b border-sand-300/70 text-[12px] sm:text-[11px] text-stone-500">
                        <th className="w-7 pb-1 text-left font-semibold">
                          #
                        </th>
                        <th className="pb-1 text-left font-semibold">
                          Equipo
                        </th>
                        <th className="pb-1 text-right font-semibold">
                          PJ
                        </th>
                        <th className="pb-1 text-right font-semibold">
                          G
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-200/70">
                      {rows.map((row, idx) => {
                        const isLeader = idx === 0;
                        const isLive = liveTeamIds.has(row.teamId);

                        return (
                          <tr
                            key={row.teamId}
                            className={isLive ? "bg-white/60" : ""}
                          >
                            <td className="py-2">
                              <span
                                className={`font-display text-base tabular-nums ${
                                  isLeader ? "text-selva-800" : "text-stone-400"
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="text-[16px] sm:text-[15px] font-medium text-stone-800">
                                <span className="block truncate">{row.teamName}</span>
                                {isLive && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] sm:text-[11px] font-medium text-ember-500">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
                                    en vivo
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 text-right font-display text-base tabular-nums text-stone-600">
                              {row.played}
                            </td>
                            <td className="py-2 text-right font-display text-base tabular-nums text-stone-600">
                              {row.won}
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
    </div>
  );
}

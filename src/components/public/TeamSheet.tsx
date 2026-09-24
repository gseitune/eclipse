"use client";

import { useEffect, useRef, useMemo } from "react";
import { stageLabel, zoneName, isKnownZone } from "@/lib/front/phase";
import type { StateSnapshot, StandingRow, MatchPublic } from "@/lib/front/types";

interface TeamSheetProps {
  team: { id: string; name: string; zone: string } | null;
  onClose: () => void;
  state: StateSnapshot | null;
  standingsRow: StandingRow | null;
  position?: number;
}

export function TeamSheet({ team, onClose, state, standingsRow, position = 0 }: TeamSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Scroll lock
  useEffect(() => {
    if (team) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [team]);

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus close button on open
  useEffect(() => {
    if (team && closeRef.current) {
      closeRef.current.focus();
    }
  }, [team]);

  // Schedule lookup map (memoized, before early return)
  const scheduleMap = useMemo(() => {
    const map = new Map<string, { estimated: string | null; scheduled: string | null }>();
    if (state) {
      for (const s of state.schedule) {
        map.set(s.id, { estimated: s.estimated, scheduled: s.scheduled });
      }
    }
    return map;
  }, [state]);

  if (team === null) return null;

  const zoneLabel = isKnownZone(team.zone) ? zoneName(team.zone) : null;

  // Build matches list
  const matches = buildMatches(team, state, scheduleMap);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-6"
      role="presentation"
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${team ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />

      {/* Panel */}
      <div
        className={`relative w-full max-w-lg sm:max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl transition-transform duration-200 sm:max-h-[85vh] overflow-y-auto ${team ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        role="dialog"
        aria-modal="true"
        aria-label={zoneLabel ? `${team.name} — ${zoneLabel}` : team.name}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between bg-white px-6 py-4 border-b border-sand-200 rounded-t-2xl sm:rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-stone-900">{team.name}</h3>
            {zoneLabel && (
              <span className="inline-flex items-center rounded-full bg-amber-700/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {zoneLabel}
              </span>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:bg-sand-100 hover:text-stone-700 transition-colors"
            aria-label="Cerrar ficha del equipo"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Standings digest */}
          {standingsRow && (
            <div className="rounded-xl border border-sand-200 bg-sand-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Posición</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-xs text-stone-400">#</p>
                  <p className="text-xl font-bold text-stone-900">{position}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">PJ</p>
                  <p className="text-xl font-bold text-stone-900">{standingsRow.played}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">G</p>
                  <p className="text-xl font-bold text-stone-900">{standingsRow.won}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">P</p>
                  <p className="text-xl font-bold text-stone-900">{standingsRow.lost}</p>
                </div>
                <div className="col-span-4">
                  <p className="text-xs text-stone-400">DG</p>
                  <p className="text-xl font-bold text-stone-900">{standingsRow.setDiff}</p>
                </div>
              </div>
            </div>
          )}

          {/* Matches list */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">Partidos</h4>
            {matches.length === 0 ? (
              <p className="text-sm text-stone-400">Sin partidos cargados en este momento.</p>
            ) : (
              <ul className="space-y-2" role="list">
                {matches.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-lg border border-sand-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{item.label}</p>
                      <p className="text-xs text-stone-500">{item.subtitle}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMatches(
  team: { id: string; name: string; zone: string },
  state: StateSnapshot | null,
  scheduleMap: Map<string, { estimated: string | null; scheduled: string | null }>,
): Array<{ label: string; subtitle: string }> {
  if (!team || !state) return [];
  const tid = team.id;
  const results: Array<{ label: string; subtitle: string }> = [];

  // From brackets
  for (const m of state.brackets) {
    if (m.teamAId === tid || m.teamBId === tid) {
      const result = matchResultLabel(m, tid, scheduleMap);
      results.push({ label: stageLabel(m.stage), subtitle: result });
    }
  }

  // From desempate
  const dm = state.desempate.match;
  if (dm && (dm.teamA?.id === tid || dm.teamB?.id === tid)) {
    const opponent = dm.teamA?.id === tid ? dm.teamB?.name ?? "" : dm.teamA?.name ?? "";
    results.push({ label: "Desempate", subtitle: opponent ? `vs ${opponent}` : "Desempate" });
  }

  // From nextMatch
  const nm = state.nextMatch;
  if (nm && (nm.teamAId === tid || nm.teamBId === tid)) {
    const opponent = nm.teamAId === tid ? nm.teamB?.name ?? "" : nm.teamA?.name ?? "";
    const sch = scheduleMap.get(nm.id);
    const window = sch?.estimated ?? sch?.scheduled ?? null;
    results.push({ label: "Próximo", subtitle: window ? `${opponent} · ${window}` : opponent });
  }

  return results;
}

function matchResultLabel(
  m: MatchPublic,
  teamId: string,
  scheduleMap: Map<string, { estimated: string | null; scheduled: string | null }>,
): string {
  const oppName = m.teamAId === teamId ? m.teamB?.name ?? "" : m.teamA?.name ?? "";

  switch (m.resultStatus) {
    case "COMPLETE": {
      const teamWon = m.winnerId === teamId;
      const teamSets = m.teamAId === teamId ? (m.setAScore ?? 0) : (m.setBScore ?? 0);
      const oppSets = m.teamAId === teamId ? (m.setBScore ?? 0) : (m.setAScore ?? 0);
      return teamWon ? `Ganó ${teamSets} - ${oppSets}` : `Perdió ${teamSets} - ${oppSets}`;
    }
    case "WINNER_ONLY": {
      const teamWon = m.winnerId === teamId;
      const winnerName = m.winner?.name ?? "";
      return teamWon ? "Ganó" : `Perdió ${winnerName}`;
    }
    case "PENDING": {
      const sch = scheduleMap.get(m.id);
      const window = sch?.estimated ?? sch?.scheduled ?? null;
      return window ? `vs ${oppName} · ${window}` : `vs ${oppName}`;
    }
    default:
      return "";
  }
}

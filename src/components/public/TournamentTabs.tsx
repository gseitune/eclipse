"use client";

import { useState } from "react";
import { hasBracketResult } from "@/lib/front/phase";
import type {
  MatchPublic,
  RankingResponse,
  ScheduleRow,
  StandingRow,
  TeamPublic,
  ZoneId,
} from "@/lib/front/types";
import { StandingsTables } from "./StandingsTables";
import { EliminatoriesView } from "./EliminatoriesView";
import { FinalStandings } from "./FinalStandings";

type TabId = "grupos" | "llaves" | "final";

const TABS: { id: TabId; label: string }[] = [
  { id: "grupos", label: "Fase de grupos" },
  { id: "llaves", label: "Llaves" },
  { id: "final", label: "Posiciones finales" },
];

interface TournamentTabsProps {
  phase: string;
  standings: Partial<Record<ZoneId, StandingRow[]>>;
  zones: Record<ZoneId, TeamPublic[]>;
  liveTeamIds: Set<string>;
  initialZone: ZoneId;
  onOpenTeam: (team: { id: string; name: string; zone: string }) => void;
  brackets: MatchPublic[];
  schedule: ScheduleRow[];
  matchMinutes: number;
  ranking: RankingResponse | null;
}

/**
 * Single card that holds the three views of the current etapa (groups,
 * bracket and final standings) behind tabs, so the viewer picks what to see.
 * The etapa name and phase live in the hero, so the card opens straight on
 * its tabs.
 */
export function TournamentTabs({
  phase,
  standings,
  zones,
  liveTeamIds,
  initialZone,
  onOpenTeam,
  brackets,
  schedule,
  matchMinutes,
  ranking,
}: TournamentTabsProps) {
  // The card opens on the group view and flips to the bracket only once the
  // knockout has its first decided result. An explicit pick always wins, so a
  // viewer reading another tab is not moved while results come in.
  const bracketReady = hasBracketResult(brackets);
  const [picked, setPicked] = useState<TabId | null>(null);
  const tab = picked ?? (bracketReady ? "llaves" : "grupos");

  return (
    <section
      aria-label="Torneo"
      className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200"
    >
      <div
        role="tablist"
        aria-label="Secciones del torneo"
        className="flex gap-2"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(t.id)}
              className={`min-h-[44px] flex-1 rounded-lg px-2 text-xs font-semibold transition-colors sm:text-sm ${
                active
                  ? "bg-amber-700 text-white"
                  : "bg-sand-100 text-stone-700 hover:bg-sand-200"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-4">
        {tab === "grupos" && (
          <StandingsTables
            standings={standings}
            zones={zones}
            liveTeamIds={liveTeamIds}
            initialZone={initialZone}
            onOpenTeam={onOpenTeam}
          />
        )}
        {tab === "llaves" && (
          <EliminatoriesView
            brackets={brackets}
            phase={phase}
            schedule={schedule}
            matchMinutes={matchMinutes}
            onOpenTeam={onOpenTeam}
          />
        )}
        {tab === "final" && <FinalStandings ranking={ranking} />}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { hasBracketResult } from "@/lib/front/phase";
import { tabLockReason, type TournamentTabId } from "@/lib/front/tabs";
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

const TABS: { id: TournamentTabId; label: string }[] = [
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
  etapaId: string;
  etapaClosed: boolean;
}

/**
 * Single card that holds the three views of the current etapa (groups,
 * bracket and final standings) behind tabs, so the viewer picks what to see.
 * The etapa name and phase live in the hero, so the card opens straight on
 * its tabs.
 *
 * The bracket tab stays locked until the group stage is over and the final
 * standings tab until the organizer closes the fecha; both locks are decided
 * by tabLockReason (see src/lib/front/tabs.ts).
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
  etapaId,
  etapaClosed,
}: TournamentTabsProps) {
  const lockCtx = { phase, etapaClosed };
  const lockedTabs = TABS.flatMap((t) => {
    const reason = tabLockReason(t.id, lockCtx);
    return reason === null ? [] : [{ id: t.id, label: t.label, reason }];
  });

  // The card opens on the group view and flips to the bracket only once the
  // knockout has its first decided result. An explicit pick always wins, so a
  // viewer reading another tab is not moved while results come in. A locked
  // tab is never rendered, not even while it is picked.
  const bracketReady = hasBracketResult(brackets);
  const [picked, setPicked] = useState<TournamentTabId | null>(null);
  const wanted = picked ?? (bracketReady ? "llaves" : "grupos");
  const tab: TournamentTabId =
    tabLockReason(wanted, lockCtx) === null ? wanted : "grupos";

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
          const locked = tabLockReason(t.id, lockCtx);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={locked !== null}
              aria-disabled={locked !== null}
              title={locked ?? undefined}
              onClick={() => setPicked(t.id)}
              className={`min-h-[44px] flex-1 rounded-lg px-2 text-xs font-semibold transition-colors sm:text-sm ${
                locked !== null
                  ? "cursor-not-allowed bg-sand-100/50 text-stone-400"
                  : active
                    ? "bg-sun-500/90 text-stone-900"
                    : "bg-sand-100 text-stone-700 hover:bg-sand-200"
              }`}
            >
              {locked !== null && <span aria-hidden="true">🔒 </span>}
              {t.label}
            </button>
          );
        })}
      </div>

      {lockedTabs.length > 0 && (
        <ul className="mt-3 space-y-1">
          {lockedTabs.map((t) => (
            <li key={t.id} className="text-xs text-stone-500">
              <span aria-hidden="true">🔒 </span>
              <span className="font-semibold">{t.label}</span>: {t.reason}
            </li>
          ))}
        </ul>
      )}

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
        {tab === "final" && (
          <FinalStandings ranking={ranking} etapaId={etapaId} />
        )}
      </div>
    </section>
  );
}

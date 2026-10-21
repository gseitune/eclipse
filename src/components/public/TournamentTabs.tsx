"use client";

import { useState } from "react";
import { hasBracketResult } from "@/lib/front/phase";
import { tabLockReason, type TournamentTabId } from "@/lib/front/tabs";
import type {
  MatchPublic,
  StandingRow,
  TeamPublic,
  ZoneId,
} from "@/lib/front/types";
import { StandingsTables } from "./StandingsTables";
import { EliminatoriesView } from "./EliminatoriesView";

const TABS: { id: TournamentTabId; label: string }[] = [
  { id: "grupos", label: "Fase de grupos" },
  { id: "llaves", label: "Llaves" },
];

interface TournamentTabsProps {
  phase: string;
  standings: Partial<Record<ZoneId, StandingRow[]>>;
  zones: Record<ZoneId, TeamPublic[]>;
  liveTeamIds: Set<string>;
  initialZone: ZoneId;
  brackets: MatchPublic[];
  liveIds: Set<string>;
  etapaClosed: boolean;
}

/**
 * Single card that holds the two views of the current etapa (groups and
 * bracket) behind tabs, so the viewer picks what to see. The etapa name and
 * phase live in the hero, so the card opens straight on its tabs.
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
  brackets,
  liveIds,
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
      className="rounded-2xl border border-selva-200 bg-selva-50 p-4 shadow-[0_18px_40px_-34px_rgba(23,43,24,0.28)] sm:p-6"
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
              className={`min-h-[44px] flex-1 rounded-lg px-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sunset-600 sm:text-sm ${
                locked !== null
                  ? "cursor-not-allowed bg-white/30 text-stone-400"
                  : active
                    ? "bg-tierra-900 text-sand-50"
                    : "bg-white/80 text-stone-600 hover:bg-white"
              }`}
            >
              {locked !== null && <span aria-hidden="true">ðŸ”’ </span>}
              {t.label}
            </button>
          );
        })}
      </div>

      {lockedTabs.length > 0 && (
        <ul className="mt-3 space-y-1">
          {lockedTabs.map((t) => (
            <li key={t.id} className="text-[13px] sm:text-xs text-stone-500">
              <span aria-hidden="true">ðŸ”’ </span>
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
          />
        )}
        {tab === "llaves" && (
          <EliminatoriesView
            brackets={brackets}
            phase={phase}
            liveIds={liveIds}
          />
        )}
      </div>
    </section>
  );
}

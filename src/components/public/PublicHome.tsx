"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLiveState } from "@/lib/front/use-live-state";
import { phaseLabel, isKnownPhase } from "@/lib/front/phase";
import { liveMatchIds } from "@/lib/front/live";
import { useChime } from "@/lib/front/chime";
import type { StateSnapshot, ZoneId, TeamPublic, StandingRow } from "@/lib/front/types";
import { Hero } from "./Hero";
import { StandingsTables } from "./StandingsTables";
import { MatchTicker } from "./MatchTicker";
import { EliminatoriesView } from "./EliminatoriesView";
import { TeamSheet } from "./TeamSheet";
import { ChimeBanner } from "./ChimeBanner";

export function PublicHome({ initial }: { initial: StateSnapshot | null }) {
  const { state, loading, error } = useLiveState({ initial });

  // Mount chime hook — triggers audio on new live matches
  useChime({ state, matchMinutes: state?.matchMinutes ?? 20 });

  const live = state !== null;
  const phase = state?.phase ?? "GROUPS";

  const { liveIds, liveTeamIds, initialZone } = useMemo(() => {
    if (!state) {
      return { liveIds: new Set<string>(), liveTeamIds: new Set<string>(), initialZone: "A" as ZoneId };
    }

    const ids = liveMatchIds(state.schedule, state.matchMinutes);

    const next = state.nextMatch;
    const nextLive = next !== null && ids.has(next.id);

    const teamIds = new Set<string>();
    if (nextLive) {
      if (next.teamAId) teamIds.add(next.teamAId);
      if (next.teamBId) teamIds.add(next.teamBId);
    }

    const zone: ZoneId = nextLive && next.zone ? next.zone : "A";

    return { liveIds: ids, liveTeamIds: teamIds, initialZone: zone };
  }, [state]);

  // Lifted openTeam state — shared between StandingsTables and EliminatoriesView
  const [openTeam, setOpenTeam] = useState<{ id: string; name: string; zone: string } | null>(null);

  function handleOpenTeam(team: { id: string; name: string; zone: string }) {
    setOpenTeam(team);
  }

  function handleCloseTeamSheet() {
    setOpenTeam(null);
  }

  const isEliminatories = phase === "ELIMINATORIES";
  const isDesempate = phase === "DESEMPATE";
  const known = isKnownPhase(phase);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Organizer link — fixed top-right corner */}
      <Link
        href="/organizador"
        className="fixed right-0 top-0 z-50 rounded-bl-xl border-b border-l border-sand-300 bg-sand-50 px-4 py-2 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-sand-300 transition-colors hover:bg-sand-100 min-h-[44px] inline-flex items-center"
      >
        Organizador
      </Link>

      {/* Loading skeleton */}
      {loading && !initial && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
            <span className="text-sm text-stone-600">Cargando...</span>
          </div>
        </div>
      )}

      {/* Hero */}
      <Hero live={live} />

      {/* Connection-lost banner — only when live stream drops */}
      {error && (
        <div className="mx-auto w-full max-w-3xl px-6 py-3">
          <div className="flex items-center gap-1.5 rounded-2xl border border-ember-200 bg-ember-50/60 px-4 py-2 text-xs text-ember-600">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
            Conexión perdida...
          </div>
        </div>
      )}

        {/* Result-pending banner */}
        <ChimeBanner liveCount={liveIds.size} />

        {/* Sections */}
      <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
        {/* DESEMPATE banner above standings */}
        {isDesempate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            Zonas definidas — desempate por el segundo mejor.
          </div>
        )}

        {/* Phase-branched content */}
        {isEliminatories ? (
          <EliminatoriesView
            brackets={state?.brackets ?? []}
            phase={phase}
            schedule={state?.schedule ?? []}
            matchMinutes={state?.matchMinutes ?? 20}
            onOpenTeam={handleOpenTeam}
          />
        ) : (
          <>
            <StandingsTables
              standings={state?.standings ?? {}}
              zones={state?.zones ?? { A: [], B: [], C: [] } as Record<ZoneId, TeamPublic[]>}
              liveIds={liveIds}
              liveTeamIds={liveTeamIds}
              initialZone={initialZone}
              phase={phase}
              onOpenTeam={handleOpenTeam}
            />

            <MatchTicker
              schedule={state?.schedule ?? []}
              brackets={state?.brackets ?? []}
              nextMatch={state?.nextMatch ?? null}
              desempate={state?.desempate ?? { needed: false, pending: false, match: null }}
              matchMinutes={state?.matchMinutes ?? 20}
            />
          </>
        )}

        {/* Agenda / Final positions link */}
        {isEliminatories || isDesempate ? (
          <Link
            href="/agenda"
            className="flex items-center justify-center rounded-xl border border-sand-300 bg-white/70 py-3 text-sm font-semibold text-stone-700 backdrop-blur ring-1 ring-inset ring-sand-200 hover:bg-sand-100 transition-colors min-h-[44px]"
          >
            Ver posiciones finales
          </Link>
        ) : (
          <Link
            href="/agenda"
            className="flex items-center justify-center rounded-xl border border-sand-300 bg-white/70 py-3 text-sm font-semibold text-stone-700 backdrop-blur ring-1 ring-inset ring-sand-200 hover:bg-sand-100 transition-colors min-h-[44px]"
          >
            Ver agenda completa
          </Link>
        )}

        {/* Unknown phase fallback — keep standings/ticker working */}
        {!known && (
          <div className="rounded-2xl border border-sand-300 bg-white/70 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
            <h2 className="text-lg font-semibold text-stone-900">Estado del torneo</h2>
            <p className="mt-2 text-sm text-stone-500">
              {phaseLabel(phase)}
            </p>
          </div>
        )}
      </div>

      {/* TeamSheet modal — rendered at PublicHome level */}
      {openTeam && (
        <TeamSheet
          team={openTeam}
          onClose={handleCloseTeamSheet}
          state={state}
          standingsRow={(() => {
            if (openTeam.zone === "—") return null;
            const rows = state?.standings[openTeam.zone as keyof typeof state.standings] ?? [];
            return rows.find((r: StandingRow) => r.teamId === openTeam.id) ?? null;
          })()}
          position={(() => {
            if (openTeam.zone === "—") return 0;
            const rows = state?.standings[openTeam.zone as keyof typeof state.standings] ?? [];
            return rows.findIndex((r: StandingRow) => r.teamId === openTeam.id) + 1;
          })()}
        />
      )}

      {/* Footer with GS badge */}
      <footer className="mt-auto flex items-center justify-between gap-4 border-t border-sand-200 px-6 py-5 text-sm text-stone-500">
        <span>SELVARENA · deporte de playa - Beach Voley</span>
        <span className="flex items-center gap-1 font-bold uppercase">
          GS proyecto eclipse
        </span>
      </footer>
    </div>
  );
}

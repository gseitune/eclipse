"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useLiveState } from "@/lib/front/use-live-state";
import { phaseLabel, isKnownPhase } from "@/lib/front/phase";
import { liveMatchIds } from "@/lib/front/live";
import { useChime } from "@/lib/front/chime";
import { fetchRanking } from "@/lib/front/api";
import type { StateSnapshot, ZoneId, TeamPublic, StandingRow, RankingResponse } from "@/lib/front/types";
import { Hero } from "./Hero";
import { StandingsTables } from "./StandingsTables";
import { MatchTicker } from "./MatchTicker";
import { EliminatoriesView } from "./EliminatoriesView";
import { TeamSheet } from "./TeamSheet";
import { ChimeBanner } from "./ChimeBanner";
import { RankingPanel } from "./RankingPanel";

export function PublicHome({
  initial,
  isPreview = false,
}: {
  initial: StateSnapshot | null;
  isPreview?: boolean;
}) {
  const { state, loading, error } = useLiveState({ initial });

  // Mount chime hook — triggers audio on new live matches
  useChime({ state, matchMinutes: state?.matchMinutes ?? 20 });

  // Active etapa finished state — from ranking (not state), so a finished
  // etapa never shows EN VIVO
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRanking()
      .then((resp) => {
        if (!cancelled) setRanking(resp);
      })
      .catch(() => {
        if (!cancelled) setRanking(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      {/* Top bar — static, scrolls with the page */}
      <div className="flex items-start justify-between px-3 pt-3">
        <div className="pointer-events-none">
          <div className="-ml-8 w-40 rotate-[-45deg] bg-amber-600 py-1 text-center text-[11px] font-bold uppercase tracking-widest text-white shadow-md">
            BETA TEST
          </div>
        </div>

        {/* Organizer button — static top-right, hidden inside organizer preview */}
        {!isPreview && (
          <Link
            href="/organizador"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-amber-600/70 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg shadow-amber-600/30 backdrop-blur transition-colors hover:bg-amber-700/80 hover:shadow-amber-700/40 sm:min-h-[44px] sm:gap-2 sm:px-5 sm:py-2.5 sm:text-xs"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Organizador
          </Link>
        )}
      </div>

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
      <Hero
        etapaName={state?.etapa?.name?.toUpperCase() ?? "ETAPA 5"}
        live={liveIds.size > 0}
        finished={
          ranking?.etapas.some(
            (e) => e.id === state?.etapaId && e.finished,
          ) ?? false
        }
      />

      {/* Connection-lost banner — only when live stream drops */}
      {error && (
        <div className="mx-auto w-full max-w-3xl px-6 py-3">
          <div className="flex items-center gap-1.5 rounded-2xl border border-ember-200 bg-ember-50/60 px-4 py-2 text-xs text-ember-600">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
            Conexión perdida...
          </div>
        </div>
      )}

        {/* Cancelled etapa banner — prominent, above all content */}
        {state?.etapa?.cancelledAt && (
          <div className="mx-auto w-full max-w-3xl px-6 py-3">
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-700">
              ⚠️ Etapa CANCELADA — esta fecha ha sido suspendida. No se
              pueden editar resultados ni modificar el orden de los
              partidos.
            </div>
          </div>
        )}

        {/* Result-pending banner */}
        <ChimeBanner liveCount={liveIds.size} />

        {/* Sections */}
      <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
        {/* DESEMPATE banner above standings */}
        {isDesempate && (
          <div className="rounded-xl border border-amber-soft-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
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
            <MatchTicker
              schedule={state?.schedule ?? []}
              brackets={state?.brackets ?? []}
              nextMatch={state?.nextMatch ?? null}
              desempate={state?.desempate ?? { needed: false, pending: false, match: null }}
              matchMinutes={state?.matchMinutes ?? 20}
            />

            <StandingsTables
              standings={state?.standings ?? {}}
              zones={state?.zones ?? { A: [], B: [], C: [] } as Record<ZoneId, TeamPublic[]>}
              liveIds={liveIds}
              liveTeamIds={liveTeamIds}
              initialZone={initialZone}
              phase={phase}
              onOpenTeam={handleOpenTeam}
            />
          </>
        )}

        {/* Combined points panel (S3) */}
        <RankingPanel />

        {/* Unknown phase fallback — keep standings/ticker working */}
        {!known && (
          <div className="rounded-2xl border border-sand-300 bg-white/40 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
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
        <span>SELVARENA · Deportes de playa - Beach Voley</span>
        <span className="flex items-center gap-1 font-bold uppercase">
          GS proyecto eclipse
        </span>
      </footer>
    </div>
  );
}

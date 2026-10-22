"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useLiveState } from "@/lib/front/use-live-state";
import { phaseLabel, isKnownPhase } from "@/lib/front/phase";
import { liveMatchIdsForEtapa } from "@/lib/front/live";
import { fetchGallery, fetchRanking } from "@/lib/front/api";
import type { Circuit, StateSnapshot, ZoneId, TeamPublic, RankingResponse } from "@/lib/front/types";import type { FotoGaleria } from "@/lib/front/galeria";
import { Hero } from "./Hero";
import { HeroCarousel } from "./HeroCarousel";
import { TournamentSwitch, type TournamentId } from "./TournamentSwitch";
import { MatchTicker } from "./MatchTicker";
import { TournamentTabs } from "./TournamentTabs";
import { RankingPanel } from "./RankingPanel";
import { GaleriaCarrusel } from "./GaleriaCarrusel";
import { PodiosCarrusel } from "./PodiosCarrusel";
import { IconoInstagram } from "./IconoInstagram";
import { IconoEngranaje } from "@/components/Iconos";
import { IconoLinkedin } from "@/components/Iconos";

/** Redes oficiales. Único dato manual de los links. */
const INSTAGRAM_SELVARENA = "https://www.instagram.com/selvarena_obera/";
const INSTAGRAM_DACOSTA = "https://www.instagram.com/dacosta.fotodeportiva/";
const LINKEDIN_GABRIEL =
  "https://www.linkedin.com/in/gabriel-alejandro-seitune-783201129/";
export function PublicHome({
  initial,
  initialRanking,
  initialCircuit,
  isPreview = false,
  fotos,
  albumUrl,
}: {
  initial: StateSnapshot | null;
  /** Ranking rendered by the server, so the podium is there on first paint. */
  initialRanking: RankingResponse | null;
  /** Circuit rendered by the server, taken from `?circuito=`. */
  initialCircuit: Circuit;
  isPreview?: boolean;
  /** Fotos ya armadas por el servidor. Vacío = la galería no se dibuja. */
  fotos: FotoGaleria[];
  /** Link a la carpeta completa del fotógrafo en Drive. */
  albumUrl: string;
}) {
  // Which circuit the viewer follows. The switch at the top decides it and the
  // whole page follows: state, annual table and gallery. The choice also goes
  // into the URL, so a refresh (or a shared link) keeps the same circuit.
  const [tournament, setTournament] = useState<TournamentId>(
    initialCircuit === "INTERMEDIOS" ? "intermedios" : "principiantes",
  );
  const circuit: Circuit =
    tournament === "intermedios" ? "INTERMEDIOS" : "PRINCIPIANTES";

  function changeCircuit(id: TournamentId) {
    setTournament(id);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (id === "intermedios") url.searchParams.set("circuito", "intermedios");
    else url.searchParams.delete("circuito");
    window.history.replaceState({}, "", url.toString());
  }

  const { state, loading, error } = useLiveState({ initial, circuit });

  // Active etapa finished state — from ranking (not state), so a finished
  // etapa never shows EN VIVO
  const [ranking, setRanking] = useState<RankingResponse | null>(initialRanking);
  useEffect(() => {
    let cancelled = false;
    fetchRanking(circuit)
      .then((resp) => {
        if (!cancelled) setRanking(resp);
      })
      .catch(() => {
        if (!cancelled) setRanking(null);
      });
    return () => {
      cancelled = true;
    };
  }, [circuit]);

  // Podios de todas las etapas cerradas: el tablero cuenta la temporada
  // completa, no solo la última fecha. Se ordenan por número de etapa, así la
  // primera queda a la izquierda sin depender del orden en que se cargaron.
  const podios = useMemo(() => {
    const etapaNumber = (name: string) => {
      const match = name.match(/\d+/);
      return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
    };

    return (ranking?.etapas ?? [])
      .filter((etapa) => etapa.finished && etapa.positions.length > 0)
      .slice()
      .sort((a, b) => {
        const byNumber = etapaNumber(a.name) - etapaNumber(b.name);
        if (byNumber !== 0) return byNumber;
        const byDate = (a.date ? Date.parse(a.date) : 0) - (b.date ? Date.parse(b.date) : 0);
        if (byDate !== 0) return byDate;
        return a.sortOrder - b.sortOrder;
      })
      .map((etapa) => ({
        etapaName: etapa.name,
        top: etapa.positions
          .slice(0, 3)
          .map((p) => ({ position: p.position, teamName: p.teamName })),
      }));
  }, [ranking]);

  // Photos follow the same circuit: the server sends the initial album of
  // Principiantes, and every switch asks for the folder of the selected one.
  const [galeria, setGaleria] = useState<{
    fotos: FotoGaleria[];
    albumUrl: string;
  }>({ fotos, albumUrl });
  useEffect(() => {
    let cancelled = false;
    fetchGallery(circuit)
      .then((resp) => {
        if (!cancelled) setGaleria(resp);
      })
      .catch(() => {
        // The gallery is decorative: a failure keeps the previous photos.
      });
    return () => {
      cancelled = true;
    };
  }, [circuit]);

  const phase = state?.phase ?? "GROUPS";

  const { liveIds, liveTeamIds, initialZone } = useMemo(() => {
    if (!state) {
      return { liveIds: new Set<string>(), liveTeamIds: new Set<string>(), initialZone: "A" as ZoneId };
    }

    // A closed or cancelled etapa can never have live matches: its schedule
    // windows are time-of-day only, so they keep matching on every later day.
    const ids = liveMatchIdsForEtapa(state.schedule, state.matchMinutes, state.etapa);

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

  const isDesempate = phase === "DESEMPATE";
  const known = isKnownPhase(phase);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — static, scrolls with the page */}
      <div className="flex items-start justify-end px-3 pt-3">
        {/* Organizer button — static top-right, hidden inside organizer preview */}
        {!isPreview && (
          <Link
            href="/organizador"
            aria-label="Panel del organizador"
            title="Panel del organizador"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white/80 text-stone-600 transition-colors hover:bg-white hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600"
          >
            <IconoEngranaje className="h-5 w-5 shrink-0" />
          </Link>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && !initial && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
            <span className="text-[15px] sm:text-sm text-stone-600">Cargando...</span>
          </div>
        </div>
      )}

      {/* Hero: si hay fotos, el carrusel manda y la marca se apoya encima. */}
      {galeria.fotos.length > 0 ? (
        <HeroCarousel
          fotos={galeria.fotos}
          circuit={`Circuito Mixto ${
            circuit === "INTERMEDIOS" ? "Intermedios" : "Principiantes"
          } ${state?.etapa?.season ?? 2026}`}
          etapaName={state?.etapa?.name?.toUpperCase() ?? "—"}
          live={liveIds.size > 0}
          finished={
            ranking?.etapas.some((e) => e.id === state?.etapaId && e.finished) ??
            false
          }
        />
      ) : (
        <Hero
          circuit={`Circuito Mixto ${
            circuit === "INTERMEDIOS" ? "Intermedios" : "Principiantes"
          } ${state?.etapa?.season ?? 2026}`}
          etapaName={state?.etapa?.name?.toUpperCase() ?? "—"}
          live={liveIds.size > 0}
          finished={
            ranking?.etapas.some((e) => e.id === state?.etapaId && e.finished) ??
            false
          }
        />
      )}

      {/* Connection-lost banner — only when live stream drops. A circuit with no
          etapas is not a connection problem: it has its own empty state. */}
      {error && error !== "No etapas yet." && (
        <div className="mx-auto w-full max-w-3xl px-6 py-3">
          <div className="flex items-center gap-1.5 rounded-2xl border border-ember-200 bg-ember-50/60 px-4 py-2 text-[13px] sm:text-xs text-ember-600">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
            Conexión perdida...
          </div>
        </div>
      )}

        {/* Cancelled etapa banner — prominent, above all content */}
        {state?.etapa?.cancelledAt && (
          <div className="mx-auto w-full max-w-3xl px-6 py-3">
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[15px] sm:text-sm text-red-700">
              ⚠️ Etapa CANCELADA — esta fecha ha sido suspendida. No se
              pueden editar resultados ni modificar el orden de los
              partidos.
            </div>
          </div>
        )}

        {/* Result-pending banner */}
        {/* Sections */}
      <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-6 sm:px-6">
        {/* Circuit switch — below the hero, above the cards */}
        <div className="flex justify-center">
          <TournamentSwitch value={tournament} onChange={changeCircuit} />
        </div>

        {!state && !loading ? (
          <div className="rounded-2xl border border-selva-200 bg-selva-50 p-8 text-center shadow-[0_18px_40px_-34px_rgba(23,43,24,0.28)]">
            <p className="text-[13px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
              Circuito Mixto{" "}
              {circuit === "INTERMEDIOS" ? "Intermedios" : "Principiantes"}
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              Todavía no hay fechas
            </p>
            <p className="mt-1 text-[15px] sm:text-sm text-stone-500">
              Las fechas y resultados se publican acá cuando se cargue la primera
              etapa.
            </p>
          </div>
        ) : (
          <>
            {/* DESEMPATE banner above standings */}
            {isDesempate && (
              <div className="rounded-xl border border-amber-soft-200 bg-amber-50/60 px-4 py-3 text-[15px] sm:text-sm text-amber-700">
                Zonas definidas — desempate por el segundo mejor.
              </div>
            )}

            {/* Marcador: siempre visible. Es el ancla de la página, y si
                desapareciera al entrar en llaves el layout saltaría. */}
            <MatchTicker
              schedule={state?.schedule ?? []}
              brackets={state?.brackets ?? []}
              nextMatch={state?.nextMatch ?? null}
              desempate={state?.desempate ?? { needed: false, pending: false, match: null }}
              enCurso={
                !!state?.etapa &&
                state.etapa.closedAt == null &&
                state.etapa.cancelledAt == null
              }
            />

            {/* Groups / bracket / final standings behind tabs */}
            <TournamentTabs
              phase={phase}
              standings={state?.standings ?? {}}
              zones={state?.zones ?? ({ A: [], B: [], C: [] } as Record<ZoneId, TeamPublic[]>)}
              liveTeamIds={liveTeamIds}
              initialZone={initialZone}
              brackets={state?.brackets ?? []}
              liveIds={liveIds}
              etapaClosed={state?.etapa?.closedAt != null}
            />

            <PodiosCarrusel podios={podios} />

            {/* Combined points panel (S3) */}
            <RankingPanel circuit={circuit} />

            {/* Unknown phase fallback — keep standings/ticker working */}
            {!known && (
              <div className="rounded-2xl border border-selva-200 bg-selva-50 p-6 shadow-[0_18px_40px_-34px_rgba(23,43,24,0.28)]">
                <h2 className="text-lg font-semibold text-stone-900">Estado del torneo</h2>
                <p className="mt-2 text-[15px] sm:text-sm text-stone-500">
                  {phaseLabel(phase)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer: fotos del fotógrafo arriba, redes y créditos abajo */}
      <footer className="mt-auto border-t border-sand-200 bg-sand-50/60 text-[15px] sm:text-sm text-stone-500 backdrop-blur-sm">
        {galeria.fotos.length > 5 && (
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
            <GaleriaCarrusel
              fotos={galeria.fotos.slice(5)}
              albumUrl={galeria.albumUrl}
              creditUrl={INSTAGRAM_DACOSTA}
            />
          </div>
        )}

        <div className="mt-6 px-6 py-3">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          {/* La marca es el link a Instagram; el ícono va al final, apoyado
              sobre la misma línea de base que el wordmark. */}
          <a
            href={INSTAGRAM_SELVARENA}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="@selvarena_obera en Instagram"
            title="@selvarena_obera en Instagram"
            className="inline-flex items-end gap-1.5 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600 sm:gap-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/selvarena-logo-tierra.png"
              alt=""
              className="h-4 w-auto sm:h-5"
              draggable={false}
            />
            <IconoInstagram className="h-3.5 w-3.5 shrink-0 text-tierra-900 sm:h-4 sm:w-4" />
          </a>
          <a
            href={LINKEDIN_GABRIEL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Gabriel Alejandro Seitune en LinkedIn"
            title="Gabriel Alejandro Seitune en LinkedIn"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 transition-colors hover:text-tierra-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600 sm:text-sm"
          >
            <IconoLinkedin className="h-4 w-4 shrink-0" />
            DI Gabriel Seitune
          </a>
        </div>
        </div>
      </footer>
    </div>
  );
}

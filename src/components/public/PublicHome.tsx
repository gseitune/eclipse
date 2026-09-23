"use client";

import { useLiveState } from "@/lib/front/use-live-state";
import { phaseLabel } from "@/lib/front/phase";
import type { StateSnapshot } from "@/lib/front/types";
import { Hero } from "./Hero";

export function PublicHome({ initial }: { initial: StateSnapshot | null }) {
  const { state, loading, error } = useLiveState({ initial });

  const live = state !== null;
  const phase = state?.phase ?? "GROUPS";

  return (
    <div className="min-h-screen flex flex-col">
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

      {/* Live status strip */}
      <div className="mx-auto w-full max-w-3xl px-6 py-3">
        <div className="flex items-center justify-between rounded-2xl border border-sand-300 bg-white/70 px-4 py-2 backdrop-blur ring-1 ring-inset ring-sand-200">
          <span className="text-sm font-semibold text-stone-900">
            {phaseLabel(phase)}
          </span>
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-ember-500">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
              Conexión perdida...
            </span>
          )}
        </div>
      </div>

      {/* Placeholder sections for T4, T6, T8 */}
      <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
        <section aria-label="Posiciones" className="rounded-2xl border border-sand-300 bg-white/70 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
          <h2 className="text-lg font-semibold text-stone-900">Posiciones</h2>
          <p className="mt-2 text-sm text-stone-500">…</p>
        </section>

        <section aria-label="Marcador" className="rounded-2xl border border-sand-300 bg-white/70 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
          <h2 className="text-lg font-semibold text-stone-900">Marcador</h2>
          <p className="mt-2 text-sm text-stone-500">…</p>
        </section>

        <section aria-label="Cuadro" className="rounded-2xl border border-sand-300 bg-white/70 p-6 backdrop-blur ring-1 ring-inset ring-sand-200">
          <h2 className="text-lg font-semibold text-stone-900">Cuadro</h2>
          <p className="mt-2 text-sm text-stone-500">…</p>
        </section>
      </div>

      {/* Footer with GS badge */}
      <footer className="mt-auto flex items-center justify-between gap-4 border-t border-sand-200 px-6 py-5 text-sm text-stone-500">
        <span>SELVARENA · Circuito Mixto Principiantes 2026</span>
        <span className="flex items-center gap-1 font-bold uppercase">
          GS proyecto eclipse
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sun-transparent.png"
            alt=""
            className="h-5 w-5 shrink-0 object-contain brightness-0"
            draggable={false}
          />
        </span>
      </footer>
    </div>
  );
}

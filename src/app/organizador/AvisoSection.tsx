"use client";

import { useState } from "react";
import { useLiveState } from "@/lib/front/use-live-state";
import { liveMatchIds } from "@/lib/front/live";
import { useChime, isSoundEnabled, setSoundEnabled } from "@/lib/front/chime";

export function AvisoSection({ onBack }: { onBack: () => void }) {
  const { state } = useLiveState();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const liveCount = state !== null ? liveMatchIds(state.schedule, state.matchMinutes).size : 0;

  // Wire the chime hook so it activates on mount; the toggle controls the module flag
  useChime({ state, matchMinutes: state?.matchMinutes ?? 20, onNewLive: () => {} });

  function handleToggle() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  return (
    <div className="flex flex-col">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-sand-300 bg-sand-50 text-stone-600 hover:bg-sand-100 transition-colors min-w-[44px] min-h-[44px]"
          aria-label="Volver"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-stone-900">Aviso sonoro</h2>
      </div>

      {/* Sound toggle */}
      <section aria-label="Configuración de alerta sonora" className="mb-6">
        <div className="flex items-center justify-between rounded-xl border border-sand-300 bg-sand-50 px-5 py-4 ring-1 ring-inset ring-sand-200">
          <div>
            <span className="block text-sm font-semibold text-stone-900">
              Sonido de alerta
            </span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Ping cuando un partido entra en vivo
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 min-w-[44px] min-h-[44px] ${
              soundOn ? "bg-amber-500" : "bg-sand-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                soundOn ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Live indicator */}
      <section aria-label="Estado de partidos en vivo" className="mb-6">
        <div className="rounded-xl border border-sand-300 bg-sand-50 px-5 py-4 ring-1 ring-inset ring-sand-200">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                liveCount > 0 ? "bg-green-500 animate-pulse" : "bg-sand-300"
              }`}
            />
            <span className="text-sm font-semibold text-stone-700">
              {liveCount > 0
                ? "Hay partidos en vivo ahora"
                : "Sin partidos en vivo"}
            </span>
            {liveCount > 0 && (
              <span className="text-xs text-stone-400">({liveCount})</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

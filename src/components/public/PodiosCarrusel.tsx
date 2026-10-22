"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PositionMark } from "./PositionMark";

/**
 * Podios de las etapas anteriores. Vive en su propia card, debajo de los
 * resultados: el marcador quedó solo para los partidos del día.
 *
 * En escritorio el carrusel se mueve con las flechas del encabezado; en
 * celular se desliza con el dedo, como el resto de las tiras.
 */
export function PodiosCarrusel({
  podios,
}: {
  podios: {
    etapaName: string;
    top: { position: number; teamName: string }[];
  }[];
}) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const syncArrows = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    window.addEventListener("resize", syncArrows);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      window.removeEventListener("resize", syncArrows);
    };
  }, [podios.length, syncArrows]);

  function move(direction: 1 | -1) {
    const el = listRef.current;
    if (!el) return;
    // Un paso = ancho de una tarjeta + el gap, para que caiga alineada.
    const first = el.querySelector("li");
    const step = first ? first.getBoundingClientRect().width + 12 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  }

  if (podios.length === 0) return null;

  return (
    <section
      aria-label="Podios de la temporada"
      className="rounded-2xl border border-selva-200 bg-selva-50 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] sm:text-sm font-semibold text-stone-900">
          Podios de la temporada
        </h2>

        {podios.length > 1 && (
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!canPrev}
              aria-label="Ver podios anteriores"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 bg-white text-stone-600 transition-colors hover:bg-sand-100 hover:text-stone-900 disabled:opacity-40 disabled:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={!canNext}
              aria-label="Ver más podios"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 bg-white text-stone-600 transition-colors hover:bg-sand-100 hover:text-stone-900 disabled:opacity-40 disabled:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <ul
        ref={listRef}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {podios.map((podio) => (
          <li
            key={podio.etapaName}
            className="min-w-[11.5rem] shrink-0 snap-start rounded-xl border border-selva-100 bg-white p-3"
          >
            <p className="font-display text-base leading-tight text-selva-900">
              {podio.etapaName}
            </p>
            <ol className="mt-2 space-y-1">
              {podio.top.map((row) => (
                <li
                  key={row.position}
                  className="flex items-center gap-2 text-[14px] sm:text-[13px]"
                >
                  <PositionMark
                    position={row.position}
                    tone="metal"
                    className="h-5 w-8 rounded-sm text-[12px] sm:text-[11px] font-bold"
                  />
                  <span className="min-w-0 flex-1 truncate text-stone-700">
                    {row.teamName}
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}

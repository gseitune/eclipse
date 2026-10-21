"use client";

/**
 * Podios de las etapas anteriores. Vive en su propia card, debajo de los
 * resultados: el marcador quedó solo para los partidos del día.
 */
import { PositionMark } from "./PositionMark";

export function PodiosCarrusel({
  podios,
}: {
  podios: {
    etapaName: string;
    top: { position: number; teamName: string }[];
  }[];
}) {
  if (podios.length === 0) return null;

  return (
    <section
      aria-label="Podios de la temporada"
      className="rounded-2xl border border-selva-200 bg-selva-50 p-4 sm:p-5"
    >
      <h2 className="text-[15px] sm:text-sm font-semibold text-stone-900">
        Podios de la temporada
      </h2>

      <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

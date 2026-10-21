"use client";

import type { FotoGaleria } from "@/lib/front/galeria";
import { IconoInstagram } from "./IconoInstagram";
import { IconoMas } from "@/components/Iconos";

/**
 * Fotos del fotógrafo. La lista viene ya armada desde el servidor
 * (ver src/lib/front/galeria.ts): acá no se pide nada a Google.
 *
 * Convenciones de la casa que respeta:
 *  - Degrada en silencio: sin fotos, no dibuja nada (la home queda igual).
 *  - <img> plano a propósito, para que la miniatura la sirva Google directo y
 *    Vercel no gaste Image Optimization (5.000 transformaciones/mes en Hobby).
 *  - Los links externos van con target="_blank" + rel="noopener noreferrer".
 *  - Sin recuadro ni encabezado: la sección la enmarca el contenedor de la home
 *    que la aloja, así que acá no se repite el ancho ni el borde.
 */
export function GaleriaCarrusel({
  fotos,
  albumUrl,
  creditUrl,
}: {
  fotos: FotoGaleria[];
  /** Link a la carpeta completa del fotógrafo en Drive. */
  albumUrl: string;
  /** Instagram del fotógrafo, para acreditar la tira. */
  creditUrl: string;
}) {
  if (fotos.length === 0) return null;

  return (
    <section aria-label="Galería de fotos">
      <div className="mb-2 flex justify-end">
        <a
          href={creditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] sm:text-xs text-stone-500 transition-colors hover:text-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600"
        >
          <IconoInstagram className="h-4 w-4 shrink-0" />
          @dacosta.fotodeportiva
        </a>
      </div>

      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {fotos.map((foto) => (
          <li key={foto.id} className="shrink-0 snap-start">
            <a
              href={foto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl ring-1 ring-sand-300 transition-shadow hover:ring-selva-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selva-600"
            >
              {/* <img> plano a propósito: si usáramos next/image, cada cache
                  miss gastaría una de las 5.000 transformaciones/mes de
                  Image Optimization del plan Hobby de Vercel. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.thumbUrl}
                alt={foto.alt}
                width={400}
                height={300}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="aspect-[4/3] w-[240px] object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </a>
          </li>
        ))}
        {/* Celular: el último cuadrito del carrusel es el acceso a Drive. */}
        <li className="shrink-0 snap-start sm:hidden">
          <a
            href={albumUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver más fotos en Drive"
            className="flex aspect-[4/3] w-[240px] flex-col items-center justify-center gap-1.5 rounded-xl bg-stone-200 ring-1 ring-sand-300 transition-colors hover:bg-stone-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selva-600"
          >
            <IconoMas className="h-10 w-10 text-tierra-900" />
            <span className="text-[15px] font-semibold text-tierra-900">
              Ver más
            </span>
          </a>
        </li>
      </ul>

      <div className="mt-4 hidden justify-center sm:flex">
        <a
          href={albumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-tierra-900 px-4 text-[15px] sm:text-sm font-semibold text-white transition-colors hover:bg-tierra-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sunset-600"
        >
          Ver todas las fotos
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
            <path d="M14 4h6v6" />
            <path d="M20 4l-9 9" />
            <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
          </svg>
        </a>
      </div>
    </section>
  );
}

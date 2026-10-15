"use client";

import type { FotoGaleria } from "@/lib/front/galeria";

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
}: {
  fotos: FotoGaleria[];
  /** Link a la carpeta completa del fotógrafo en Drive. */
  albumUrl: string;
}) {
  if (fotos.length === 0) return null;

  return (
    <section aria-label="Galería de fotos">
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {fotos.map((foto) => (
          <li key={foto.id} className="shrink-0 snap-start">
            <a
              href={foto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl ring-1 ring-sand-300 transition-shadow hover:ring-amber-600/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
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
      </ul>

      <div className="mt-3 flex justify-center">
        <a
          href={albumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center rounded-full bg-amber-600/70 px-4 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-amber-700/80"
        >
          Álbum completo
        </a>
      </div>
    </section>
  );
}

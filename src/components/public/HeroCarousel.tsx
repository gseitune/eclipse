"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FotoGaleria } from "@/lib/front/galeria";

/** El thumb viene a 400px de ancho; para el hero pedimos 1600. */
function bigFoto(url: string): string {
  return url.replace(/sz=w\d+/, "sz=w1600");
}

/**
 * El hero como carrusel de fotos: la imagen es el protagonista y la marca se
 * apoya encima. Avanza solo; sin flechas. Swipe nativo con scroll-snap.
 */
export function HeroCarousel({
  fotos,
  etapaName,
  circuit,
  live,
  finished,
}: {
  fotos: FotoGaleria[];
  etapaName: string;
  circuit: string;
  live: boolean;
  finished: boolean;
}) {
  const slides = fotos.slice(0, 5);
  const count = slides.length;
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  }, []);

  // El índice sale del propio scroll: vale igual para swipe, flechas y puntos.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      setIndex(Math.round(el.scrollLeft / w));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Avance automático: se apaga con reduced-motion y se pausa al interactuar.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => goTo((index + 1) % count), 5500);
    return () => window.clearInterval(id);
  }, [count, paused, index, goTo]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
      <div
        className="relative"
        aria-roledescription="carrusel"
        aria-label="Fotos del torneo"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onPointerDown={() => setPaused(true)}
      >
        <div
          ref={scroller}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((foto, i) => (
            <div
              key={foto.id}
              className="relative w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${count}`}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-stone-950 sm:aspect-[21/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bigFoto(foto.thumbUrl)}
                  alt={foto.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                {/* La foto se oscurece abajo para que la marca tenga piso. */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-stone-950/10" />
              </div>
            </div>
          ))}
        </div>

        {/* Marca y etapa, una sola vez, sobre el carrusel. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-sand-50 sm:p-7">
          <h1 className="drop-shadow-[0_2px_12px_rgba(23,43,24,0.6)]">
            <span className="sr-only">Selvarena</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/selvarena-logo.png"
              alt=""
              className="h-8 w-auto sm:h-10"
              draggable={false}
            />
          </h1>
          <p className="mt-1.5 font-display text-lg leading-tight text-sand-100/90">
            {etapaName}
          </p>
          <p className="mt-1 text-[13px] sm:text-xs uppercase tracking-[0.2em] text-sand-100/70">
            {circuit}
          </p>

          {finished ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sand-50/15 px-2.5 py-0.5 text-[12px] sm:text-[11px] font-semibold text-sand-50 ring-1 ring-inset ring-sand-50/30">
              <span className="h-1.5 w-1.5 rounded-full bg-sand-50" />
              Etapa finalizada
            </span>
          ) : live ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember-500/20 px-2.5 py-0.5 text-[12px] sm:text-[11px] font-semibold text-ember-200 ring-1 ring-inset ring-ember-300/40">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-400" />
              EN VIVO
            </span>
          ) : null}
        </div>

        {/* Flechas fuera: el carrusel se mueve solo. Los puntos quedan como
            indicador, no como control. */}
        {count > 1 && (
          <div className="absolute right-4 top-4 flex gap-1.5 sm:right-6 sm:top-6">
            {slides.map((foto, i) => (
              <span
                key={foto.id}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-sand-50" : "w-3 bg-sand-50/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

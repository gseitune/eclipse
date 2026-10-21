"use client";

/**
 * Marca de posición de la casa. Donde antes había tres colores de medalla
 * (oro/plata/bronce) ahora hay dos lenguajes:
 *
 * - `tierra` (default): un rectángulo tierra que pierde fuerza y largo del 1.º
 *   al 3.º. Es el que usa la card de podios.
 * - `metal`: los mismos tres rectángulos, pero en la versión apagada de oro,
 *   plata y bronce. Solo lo usa el ranking de puntos del circuito.
 *
 * El rectángulo crece hacia la izquierda: el borde derecho es el mismo en los
 * tres, así los números quedan en columna y el nombre del equipo no se mueve.
 * Del 4.º en adelante no se dibuja relleno.
 *
 * Las opacidades del tierra y los tonos del metal están elegidos por contraste
 * contra el número, no a ojo: el 1.º tierra lleva número en arena (7.0:1) y el
 * 2.º y 3.º en tierra-950 (4.8:1 y 6.3:1), porque sobre un relleno claro el
 * número claro no se lee.
 */
const BAR = {
  tierra: [
    "w-full bg-tierra-900 text-sand-50",
    "w-3/4 bg-tierra-900/45 text-tierra-950",
    "w-1/2 bg-tierra-900/30 text-tierra-950",
  ],
  metal: [
    "w-full bg-oro-200 text-tierra-950",
    "w-3/4 bg-plata-200 text-tierra-950",
    "w-1/2 bg-bronce-200 text-tierra-950",
  ],
};

export function PositionMark({
  position,
  tone = "tierra",
  className = "",
}: {
  position: number;
  tone?: "tierra" | "metal";
  className?: string;
}) {
  const bar = BAR[tone][position - 1];

  return (
    <span
      className={`relative inline-flex shrink-0 justify-end tabular-nums ${className}`}
    >
      <span
        className={`flex h-full items-center justify-end rounded-sm pr-1.5 ${
          bar ?? "w-full text-stone-400"
        }`}
      >
        {position}
      </span>
    </span>
  );
}

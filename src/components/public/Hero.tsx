export function Hero({
  etapaName,
  live,
  finished,
}: {
  etapaName: string;
  live: boolean;
  finished: boolean;
}) {
  return (
    <header className="mx-auto w-full max-w-3xl px-6 py-8 text-center">
      {/* Logo mark */}
      <div className="relative mx-auto mb-6 h-20 w-20">
        <div className="absolute left-1/2 top-1/2 h-[216px] w-[216px] -translate-x-1/2 -translate-y-1/2 rounded-full -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sun-transparent.png"
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
        <div className="absolute -right-1 -bottom-1 h-10 w-10 animate-spin-slow overflow-hidden rounded-full ring-2 ring-amber-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ball-mikasa.jpg"
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </div>

      {/* Brand */}
      <h1 className="bg-gradient-to-r from-emerald-950 via-emerald-700 to-green-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
        SELVARENA
      </h1>

      {/* Stage + circuit */}
      <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
        Circuito Mixto Principiantes 2026
      </p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{etapaName}</p>

      {/* Status pill — finished, or live only on competition day */}
      {finished ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Etapa finalizada
        </div>
      ) : live ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-ember-50/80 px-3 py-1 text-xs font-semibold text-ember-600 ring-1 ring-inset ring-ember-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ember-500" />
          EN VIVO
        </div>
      ) : null}
    </header>
  );
}

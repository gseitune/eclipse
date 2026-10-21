export function Hero({
  circuit,
  etapaName,
  live,
  finished,
}: {
  circuit: string;
  etapaName: string;
  live: boolean;
  finished: boolean;
}) {
  return (
    <header className="mx-auto w-full max-w-3xl px-6 pb-6 pt-8 text-center">
      <h1 className="mx-auto">
        <span className="sr-only">Selvarena</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/selvarena-logo-dark.png"
          alt=""
          className="mx-auto h-7 w-auto sm:h-8"
          draggable={false}
        />
      </h1>

      <p className="mt-1 font-display text-lg leading-tight text-stone-600">
        {etapaName}
      </p>

      <p className="mt-1.5 text-[13px] sm:text-xs uppercase tracking-[0.2em] text-stone-600">
        {circuit}
      </p>

      {/* Estado: finalizada, o en vivo solo el día de la fecha */}
      {finished ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-selva-50/80 px-2.5 py-0.5 text-[12px] sm:text-[11px] font-semibold text-selva-700 ring-1 ring-inset ring-selva-300">
          <span className="h-1.5 w-1.5 rounded-full bg-selva-500" />
          Etapa finalizada
        </div>
      ) : live ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember-50/80 px-2.5 py-0.5 text-[12px] sm:text-[11px] font-semibold text-ember-600 ring-1 ring-inset ring-ember-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-500" />
          EN VIVO
        </div>
      ) : null}
    </header>
  );
}

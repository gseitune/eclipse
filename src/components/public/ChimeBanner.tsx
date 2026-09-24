"use client";

export function ChimeBanner({ liveCount }: { liveCount: number }) {
  if (liveCount === 0) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-3">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 ring-1 ring-inset ring-amber-200">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-semibold">Hay partidos en vivo</span>
        <span className="text-amber-600">— El organizador está cargando resultados</span>
      </div>
    </div>
  );
}

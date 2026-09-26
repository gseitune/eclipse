import type { EtapaPosition } from "@/lib/front/types";

/* ── Trophy icon (gold / silver / bronze) with a star in the middle ── */
function TrophyIcon({
  tier,
  className = "h-8 w-8",
}: {
  tier: "gold" | "silver" | "bronze";
  className?: string;
}) {
  const cupClass =
    tier === "gold"
      ? "text-yellow-400"
      : tier === "silver"
        ? "text-slate-300"
        : "text-amber-700";
  const starClass =
    tier === "gold"
      ? "fill-amber-50"
      : tier === "silver"
        ? "fill-white"
        : "fill-amber-100";
  const label =
    tier === "gold" ? "Oro" : tier === "silver" ? "Plata" : "Bronce";
  return (
    <span
      className={`inline-flex ${cupClass}`}
      role="img"
      aria-label={`Trofeo ${label}`}
      title={`Trofeo ${label}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        {/* Cup body */}
        <path d="M7 3h10a1 1 0 0 1 1 1v2a5.5 5.5 0 0 1-4.2 5.35A3 3 0 0 1 12 13a3 3 0 0 1-1.8-1.65A5.5 5.5 0 0 1 6 6V4a1 1 0 0 1 1-1Z" />
        {/* Handles */}
        <path
          d="M7.2 4H4.8v.8a3.3 3.3 0 0 0 2.9 3.28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M16.8 4h2.4v.8a3.3 3.3 0 0 1-2.9 3.28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Stem */}
        <path d="M11 13.5h2v3.5h-2z" />
        {/* Base */}
        <path d="M7.4 20h9.2l-.6-2H8l-.6 2Z" />
        {/* Star in the middle */}
        <path
          className={starClass}
          d="M12 7.1l.9 1.9 2 .3-1.5 1.4.4 2L12 11.8l-1.8.9.4-2-1.5-1.4 2-.3.9-1.9Z"
        />
      </svg>
    </span>
  );
}

/* ── Podium: 1° top-center (gold trophy), 2° bottom-left (silver), 3° bottom-right (bronze) ── */
export function Podium({ positions }: { positions: EtapaPosition[] }) {
  const top1 = positions.find((p) => p.position === 1);
  const top2 = positions.find((p) => p.position === 2);
  const top3 = positions.find((p) => p.position === 3);
  if (!top1 && !top2 && !top3) return null;

  return (
    <div className="mt-5 grid grid-cols-3 items-end gap-2">
      {/* 2nd — bottom-left silver */}
      <div className="flex flex-col items-center">
        <TrophyIcon tier="silver" className="h-7 w-7" />
        <p className="mt-1.5 w-full truncate text-center text-sm font-medium text-stone-700">
          {top2?.teamName ?? "—"}
        </p>
        <p className="mt-1 flex h-6 w-full items-center justify-center rounded-t-lg bg-slate-300 text-xs font-bold text-stone-700">
          2°
        </p>
      </div>

      {/* 1st — top-center gold */}
      <div className="flex flex-col items-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Campeón
        </p>
        <TrophyIcon tier="gold" className="mt-0.5 h-10 w-10" />
        <p className="mt-1.5 w-full truncate text-center text-base font-bold text-stone-900">
          {top1?.teamName ?? "—"}
        </p>
        <p className="mt-1 flex h-9 w-full items-center justify-center rounded-t-lg bg-yellow-400 text-sm font-bold text-stone-900">
          1°
        </p>
      </div>

      {/* 3rd — bottom-right bronze */}
      <div className="flex flex-col items-center">
        <TrophyIcon tier="bronze" className="h-6 w-6" />
        <p className="mt-1.5 w-full truncate text-center text-sm font-medium text-stone-700">
          {top3?.teamName ?? "—"}
        </p>
        <p className="mt-1 flex h-5 w-full items-center justify-center rounded-t-lg bg-amber-700/70 text-xs font-bold text-amber-50">
          3°
        </p>
      </div>
    </div>
  );
}
"use client";

export type TournamentId = "principiantes" | "intermedios";

const OPTIONS: { id: TournamentId; label: string }[] = [
  { id: "principiantes", label: "Principiante/Intermedio" },
  { id: "intermedios", label: "Intermedio/Avanzado" },
];

/**
 * Circuit switch shown below the hero, above the cards. Toggles between the two
 * circuits like the reference standings page. The labels are display-only: the
 * ids keep the ?circuito= URL and the API contract unchanged.
 */
export function TournamentSwitch({
  value,
  onChange,
}: {
  value: TournamentId;
  onChange: (id: TournamentId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Elegir torneo"
      className="inline-flex w-full max-w-sm gap-1 rounded-2xl border border-stone-300 bg-white/80 p-1"
    >
      {OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`flex min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 text-center font-display text-[16px] leading-tight sm:text-[15px] tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-selva-600 ${
              active
                ? "bg-tierra-900 text-sand-50"
                : "text-stone-600 hover:bg-white"
            }`}
          >
            {option.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

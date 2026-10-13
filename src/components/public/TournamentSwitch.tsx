"use client";

export type TournamentId = "principiantes" | "intermedios";

const OPTIONS: { id: TournamentId; label: string }[] = [
  { id: "principiantes", label: "Principiantes" },
  { id: "intermedios", label: "Intermedios" },
];

/**
 * Circuit switch shown below the hero, above the cards. Toggles between the two
 * circuits like the reference standings page. The intermediates backend is not
 * loaded yet, so selecting it renders a "coming soon" panel on the page.
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
      className="inline-flex rounded-full border border-sand-300 bg-white/60 p-1 shadow-sm backdrop-blur"
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
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
              active
                ? "bg-sun-500/90 text-stone-900 shadow"
                : "text-stone-600 hover:bg-sand-100"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

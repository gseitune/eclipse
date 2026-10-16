/**
 * Player-name aliases — pure module, no I/O.
 *
 * Confirmed player-name aliases. This is a WHITELIST on purpose: an alias is
 * collapsed only when it is an explicit, confirmed equivalence. Any other name
 * keeps its exact form, so similar-but-different people (Cami vs CamiC) never
 * merge by accident. Keys are accent-stripped lowercase; values are the
 * canonical display form.
 *
 * Used both when loading a team (so a variant does not open a second team) and
 * when aggregating the per-player ranking (so a variant stored in an older,
 * frozen etapa still sums with its canonical name).
 */

export const PLAYER_ALIASES: Readonly<Record<string, string>> = {
  sebita: "Seba",
  sebi: "Seba",
  seba: "Seba",
  gon: "Gonza",
  gonz: "Gonza",
  gonza: "Gonza",
  gaso: "Gastón",
  gaston: "Gastón",
};

/**
 * Canonical display form of a single player name: trims, and rewrites only the
 * whitelisted aliases. Everything else is returned untouched (case and accents
 * are preserved), so no accidental lowercasing or merging happens.
 */
export function canonicalPlayerName(raw: string): string {
  const trimmed = raw.trim();
  const key = trimmed.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return PLAYER_ALIASES[key] ?? trimmed;
}

/**
 * Canonical team name: canonicalizes each side of the "X y Y" pair and leaves
 * any other shape untouched. Keeps the original order and separator, only
 * swapping whitelisted aliases for their canonical form.
 */
export function canonicalTeamName(raw: string): string {
  return raw
    .trim()
    .split(/\s+y\s+/i)
    .map((token) => canonicalPlayerName(token))
    .join(" y ");
}

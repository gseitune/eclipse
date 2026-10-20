/** Etapa numbers inside one circuit: Etapa 1..8, picked from the gaps. */
export const ETAPA_MIN = 1;
export const ETAPA_MAX = 8;

const ETAPA_NAME = /^Etapa\s+(\d+)$/;

/**
 * Numbers still free in the circuit, in order.
 *
 * An etapa is named "Etapa N" when it's created, and the organizer chooses the
 * number. Offering only the ones after the last stage meant a skipped number
 * could never be loaded later; this offers every gap instead.
 */
export function availableEtapaNumbers(names: readonly string[]): number[] {
  const taken = new Set<number>();
  for (const name of names) {
    const match = ETAPA_NAME.exec(name.trim());
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= ETAPA_MIN && value <= ETAPA_MAX) taken.add(value);
  }
  const free: number[] = [];
  for (let n = ETAPA_MIN; n <= ETAPA_MAX; n += 1) {
    if (!taken.has(n)) free.push(n);
  }
  return free;
}

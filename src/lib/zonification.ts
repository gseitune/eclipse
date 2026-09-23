import { distributeTeams, type GroupId } from "./tournament";

/**
 * Zoning operations (ARMADO DE ZONAS + AJUSTE MANUAL).
 *
 * Product rule: the manual swap exists ONLY before fixture generation.
 * `zoneConfirmed` = point of no return; every mutation rejects once true.
 * All functions here are PURE (tests run without a database).
 */

export type ZoneId = GroupId;

export function canSwapZones(zoneConfirmed: boolean): boolean {
  return !zoneConfirmed;
}

export function zoneOf(
  mapping: Readonly<Record<string, GroupId>>,
  teamId: string,
): GroupId {
  const zone = mapping[teamId];
  if (!zone) throw new Error(`Team "${teamId}" is not assigned to any zone.`);
  return zone;
}

/**
 * Moves one team from one zone to another. Pure: returns a NEW mapping.
 * Rejects when the fixture is already confirmed (point of no return).
 */
export function swapZone(
  mapping: Readonly<Record<string, GroupId>>,
  teamId: string,
  from: GroupId,
  to: GroupId,
  zoneConfirmed: boolean,
): Record<string, GroupId> {
  if (zoneConfirmed) {
    throw new Error(
      "Zoning is confirmed: manual swaps are forbidden after fixture generation.",
    );
  }
  if (from === to) {
    throw new Error("Source and destination zones are the same.");
  }
  if (zoneOf(mapping, teamId) !== from) {
    throw new Error(
      `Team "${teamId}" is in zone ${zoneOf(mapping, teamId)}, not ${from}.`,
    );
  }
  return { ...mapping, [teamId]: to };
}

/**
 * Re-arms the zones randomly (organizer may repeat as many times as wanted,
 * before confirmation). Shuffles input order, then reuses the balanced
 * distributor. Returns a NEW mapping for every team id.
 */
export function regenerateZones(
  teamIds: readonly string[],
  rng: () => number = Math.random,
): Record<string, GroupId> {
  const shuffled = [...teamIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups = distributeTeams(shuffled, rng);
  const mapping: Record<string, GroupId> = {};
  for (const group of groups) {
    for (const teamId of group.teams) mapping[teamId] = group.group;
  }
  return mapping;
}

/** Counts teams per zone (balanced sizes guaranteed by the distributor). */
export function zoneSizes(
  mapping: Readonly<Record<string, GroupId>>,
): Record<ZoneId, number> {
  const sizes: Record<ZoneId, number> = { A: 0, B: 0, C: 0 };
  for (const zone of Object.values(mapping)) sizes[zone] += 1;
  return sizes;
}
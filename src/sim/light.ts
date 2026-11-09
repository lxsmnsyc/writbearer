import type Unit from './unit';

/** A change to a unit's light radius: tiles added, then a share on top. */
export interface LightBonus {
  add?: number;
  // 0.2 is 20% further
  percent?: number;
}

// Bonuses by unit, then by the source that gave them
const BONUSES = new WeakMap<Unit, Map<string, LightBonus>>();

/** Adds or replaces the bonus a source gives a unit. A second call with the same key does not stack. */
export function addLight(unit: Unit, key: string, bonus: LightBonus): void {
  let list = BONUSES.get(unit);
  if (!list) {
    list = new Map();
    BONUSES.set(unit, list);
  }
  list.set(key, bonus);
}

/** Takes back what a source gave. */
export function removeLight(unit: Unit, key: string): void {
  BONUSES.get(unit)?.delete(key);
}

/** A base radius after the unit's bonuses. The view draws mercs closer than their AI reads. */
export function lightFrom(unit: Unit, base: number): number {
  const list = BONUSES.get(unit);
  if (!list || list.size === 0) {
    return base;
  }
  let add = 0;
  let percent = 0;
  for (const bonus of list.values()) {
    add += bonus.add ?? 0;
    percent += bonus.percent ?? 0;
  }
  return Math.max(0, (base + add) * (1 + percent));
}

/** How far a unit sees, in tiles. */
export function lightOf(unit: Unit): number {
  return lightFrom(unit, unit.kit.sight);
}

/**
 * How far a unit notices others, in tiles. Its own bonuses count, and so does
 * the extra reach of the light of whoever it looks at: a wider lantern is seen
 * from further off.
 */
export function noticeOf(unit: Unit, seen?: Unit, share = 1): number {
  const own = lightFrom(unit, unit.kit.notice) * share;
  return seen ? own + (lightOf(seen) - seen.kit.sight) : own;
}

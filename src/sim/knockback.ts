import { SimEvents } from './events';
import { ROOTED } from './statuses';
import { Rank } from './types';
import type Unit from './unit';

// Step length of the push, and the least gap kept to another body (sim BODY)
const STEP = 0.25;
const BODY = 0.5;

/** Whether the built-in rules let a unit be moved at all. */
function movable(target: Unit): boolean {
  return (
    target.alive &&
    target !== target.sim.bearer &&
    target.rank !== Rank.Boss &&
    !target.statuses.has(ROOTED.id)
  );
}

/** Whether another unit's body stands in the way of a step. */
function crowded(target: Unit, x: number, z: number): boolean {
  for (const other of target.sim.living()) {
    if (other === target) {
      continue;
    }
    const after = Math.hypot(other.x - x, other.z - z);
    const before = Math.hypot(other.x - target.x, other.z - target.z);
    // A unit already overlapping may leave; it may not push deeper in
    if (after < BODY && after < before) {
      return true;
    }
  }
  return false;
}

/**
 * Pushes `target` away from the point `from` by up to `distance` tiles, in
 * small steps. It stops at a wall, a closed tile or another body. Returns the
 * distance moved. `CheckKnockback` listeners can shorten or veto it.
 */
export default function knockback(
  source: Unit,
  target: Unit,
  from: { x: number; z: number },
  distance: number,
): number {
  if (!movable(target)) {
    return 0;
  }
  const check = {
    id: 'CheckKnockback',
    disabled: false,
    source,
    target,
    distance,
  };
  target.sim.emit(SimEvents.CheckKnockback, check);
  if (check.disabled || check.distance <= 0) {
    return 0;
  }
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) {
    return 0;
  }
  const { nav } = target.sim;
  let moved = 0;
  while (moved < check.distance - 1e-9) {
    const step = Math.min(STEP, check.distance - moved);
    const x = target.x + (dx / length) * step;
    const z = target.z + (dz / length) * step;
    if ((nav && !nav.walkable(x, z)) || crowded(target, x, z)) {
      break;
    }
    target.x = x;
    target.z = z;
    moved += step;
  }
  if (moved > 0) {
    // The old route no longer starts where the unit stands
    target.route = null;
    // cc-cast-events: a knockback interrupts the target's cast here
  }
  return moved;
}

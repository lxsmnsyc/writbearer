import type Unit from '../unit';

/** The unit of a list nearest to another, or null for an empty list. */
export function nearest(from: Unit, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of units) {
    const d = from.distanceTo(u);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

// Moves toward a target and attacks once in reach.
export function engage(u: Unit, target: Unit, dt: number): void {
  u.target = target;
  if (u.distanceTo(target) <= u.kit.reach) {
    u.face(target);
    u.startAttack(target);
  } else {
    u.travel(target.x, target.z, dt, u.kit.reach * 0.9);
  }
}

// Runs from whatever frightens it.
export function flee(u: Unit, from: Unit, dt: number): void {
  const dx = u.x - from.x;
  const dz = u.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  u.target = null;
  u.walkTo(u.x + (dx / d) * 2, u.z + (dz / d) * 2, dt);
}

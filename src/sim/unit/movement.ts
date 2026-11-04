import type Unit from '../unit';

// A route is found again when its goal moves this far, or after this long.
export const ROUTE_DRIFT = 0.75;
export const ROUTE_AGE = 1;

export function face(unit: Unit, other: { x: number; z: number }): void {
  if (other.x !== unit.x || other.z !== unit.z) {
    unit.angle = Math.atan2(other.z - unit.z, other.x - unit.x);
  }
}

/**
 * Whether `attacker` stands outside the unit's front arc, about 110°
 * to each side. Shields only block from the front.
 */
export function isFlankedBy(unit: Unit, attacker: Unit): boolean {
  const dx = attacker.x - unit.x;
  const dz = attacker.z - unit.z;
  const d = Math.hypot(dx, dz) || 1;
  return (Math.cos(unit.angle) * dx + Math.sin(unit.angle) * dz) / d < -0.35;
}

/** Move speed after slows and the load carried. */
export function speedOf(unit: Unit): number {
  let speed = unit.kit.moveSpeed * unit.burden;
  for (const s of unit.statuses.values()) {
    speed *= s.def.slow ?? 1;
  }
  return speed;
}

/** Walks toward a point. Returns true once it is within `stop` tiles of it. */
export function walkTo(unit: Unit, x: number, z: number, dt: number, stop = 0.05): boolean {
  const dx = x - unit.x;
  const dz = z - unit.z;
  const d = Math.hypot(dx, dz);
  if (d <= stop) {
    return true;
  }
  const step = Math.min(d - stop, unit.speed * dt);
  const nx = unit.x + (dx / d) * step;
  const nz = unit.z + (dz / d) * step;
  // Tiles blocked for a while, such as a wall of ice, cannot be entered.
  const nav = unit.sim.nav;
  // A body inside one may only move toward open ground.
  if (
    nav?.anyShut &&
    nav.shut(nx, nz) &&
    (!nav.shut(unit.x, unit.z) || nav.exitDistance(nx, nz) >= nav.exitDistance(unit.x, unit.z))
  ) {
    unit.angle = Math.atan2(dz, dx);
    return false;
  }
  unit.x = nx;
  unit.z = nz;
  unit.angle = Math.atan2(dz, dx);
  return d - step <= stop;
}

/**
 * Walks toward a point, around obstacles when something is in the way.
 * Returns true once it is within `stop` tiles of it.
 */
export function travel(unit: Unit, x: number, z: number, dt: number, stop = 0.05): boolean {
  const { nav } = unit.sim;
  if (!nav || nav.clear(unit.x, unit.z, x, z)) {
    unit.route = null;
    return unit.walkTo(x, z, dt, stop);
  }
  let route = unit.route;
  // A route is found again when the goal moves or it grows old.
  if (
    !route ||
    Math.hypot(route.x - x, route.z - z) > ROUTE_DRIFT ||
    unit.sim.time - route.at > ROUTE_AGE
  ) {
    route = { x, z, at: unit.sim.time, points: nav.path(unit, { x, z }) };
    unit.route = route;
  }
  // Skip ahead to the furthest waypoint in a straight line.
  while (
    route.points.length > 1 &&
    nav.clear(unit.x, unit.z, route.points[1].x, route.points[1].z)
  ) {
    route.points.shift();
  }
  const next = route.points.at(0);
  if (!next) {
    return unit.walkTo(x, z, dt, stop);
  }
  if (unit.walkTo(next.x, next.z, dt, 0.05)) {
    route.points.shift();
  }
  return Math.hypot(x - unit.x, z - unit.z) <= stop;
}

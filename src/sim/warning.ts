import type Sim from './sim';
import type { Side } from './types';
import type Unit from './unit';

// A warning on the ground, as Aghanim's Labyrinth's bosses and traps give:
// a shape that fills in over its windup, then strikes whoever stands in it.
// It is how a boss's big blows and a maze's traps can be seen coming and
// walked out of.

export type WarningShape =
  | { kind: 'circle'; r: number }
  // A square on the floor, `r` from its middle to each side
  | { kind: 'square'; r: number }
  // From the warning's spot to (x2, z2), `width` across
  | { kind: 'line'; x2: number; z2: number; width: number }
  // Out to `r` from the spot, `spread` radians wide about `angle`
  | { kind: 'cone'; angle: number; spread: number; r: number };

export interface Warning {
  x: number;
  z: number;
  shape: WarningShape;
  // Seconds it takes to fill, and how far it is
  windup: number;
  t: number;
  // The side it spares, or null to strike everyone
  spare: Side | null;
  // What it does to each unit inside it when it strikes
  strike: (unit: Unit) => void;
  // A boss's warning dies with it.
  source: Unit | null;
}

// The distance from a point to a segment.
function toSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Whether a floor point is inside a warning's shape. */
export function inside(w: Warning, x: number, z: number): boolean {
  const s = w.shape;
  if (s.kind === 'circle') {
    return Math.hypot(x - w.x, z - w.z) <= s.r;
  }
  if (s.kind === 'square') {
    return Math.abs(x - w.x) <= s.r && Math.abs(z - w.z) <= s.r;
  }
  if (s.kind === 'line') {
    return toSegment(x, z, w.x, w.z, s.x2, s.z2) <= s.width / 2;
  }
  const d = Math.hypot(x - w.x, z - w.z);
  const a = Math.atan2(z - w.z, x - w.x) - s.angle;
  const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
  return d <= s.r && off <= s.spread / 2;
}

/** Puts a warning down. It strikes once its windup is over. */
export function warn(sim: Sim, w: Omit<Warning, 't'>): Warning {
  const warning = { ...w, t: 0 };
  sim.warnings.push(warning);
  return warning;
}

/**
 * Fills each warning, and strikes with those whose windup is over. A
 * warning from a unit that died is lifted.
 */
export function updateWarnings(sim: Sim, dt: number): void {
  for (const w of sim.warnings) {
    w.t += dt;
  }
  const due = sim.warnings.filter((w) => w.t >= w.windup || (w.source && !w.source.alive));
  for (let i = sim.warnings.length - 1; i >= 0; i--) {
    if (due.includes(sim.warnings[i])) {
      sim.warnings.splice(i, 1);
    }
  }
  for (const w of due) {
    if (w.source && !w.source.alive) {
      continue;
    }
    for (const u of sim.living()) {
      if (u.side !== w.spare && inside(w, u.x, u.z)) {
        w.strike(u);
      }
    }
  }
}

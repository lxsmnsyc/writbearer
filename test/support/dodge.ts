import type Sim from '../../src/sim/sim';
import type Unit from '../../src/sim/unit';
import { inside } from '../../src/sim/warning';

// The bearer as a player steers it in a boss fight: out of any warning on
// the ground it stands in, to the clear spot nearest where it wants to be,
// and otherwise back toward that spot.

const STEP = 3;
const DIRECTIONS = 12;

const warned = (sim: Sim, x: number, z: number): boolean =>
  sim.warnings.some((w) => inside(w, x, z));

// Where each bearer is running to, kept until it is out
const escapes = new WeakMap<Unit, { x: number; z: number }>();

/** Steers the bearer for a tick. `home` is where it wants to stand. */
export default function dodge(sim: Sim, bearer: Unit, home: { x: number; z: number }): void {
  if (!bearer.alive) {
    return;
  }
  if (!warned(sim, bearer.x, bearer.z)) {
    escapes.delete(bearer);
    const far = Math.hypot(home.x - bearer.x, home.z - bearer.z) > 0.6;
    bearer.order = far && !warned(sim, home.x, home.z) ? { ...home } : null;
    return;
  }
  const kept = escapes.get(bearer);
  if (kept && !warned(sim, kept.x, kept.z)) {
    bearer.order = { ...kept };
    return;
  }
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (let i = 0; i < DIRECTIONS; i++) {
    const a = (i / DIRECTIONS) * Math.PI * 2;
    for (const r of [STEP, STEP * 1.8]) {
      const x = Math.max(0.5, Math.min(sim.width - 0.5, bearer.x + Math.cos(a) * r));
      const z = Math.max(0.5, Math.min(sim.depth - 0.5, bearer.z + Math.sin(a) * r));
      if (warned(sim, x, z)) {
        continue;
      }
      const d = Math.hypot(x - bearer.x, z - bearer.z) + 0.3 * Math.hypot(x - home.x, z - home.z);
      if (d < bestD) {
        best = { x, z };
        bestD = d;
      }
    }
  }
  bearer.order = best;
  if (best) {
    escapes.set(bearer, best);
  }
}

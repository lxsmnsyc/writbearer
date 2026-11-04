import type Sim from '../sim';
import type Unit from '../unit';
import { responseDelay } from '../shout';
import { type Warning, inside } from '../warning';

// How far past a warning's edge a merc steps to be clear of it
const CLEAR = 0.8;

// Where to step to be out of a warning: away from its middle, or to the
// near side of a line.
function outOf(w: Warning, u: Unit): { x: number; z: number } {
  const s = w.shape;
  if (s.kind === 'line') {
    const dx = s.x2 - w.x;
    const dz = s.z2 - w.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((u.x - w.x) * dx + (u.z - w.z) * dz) / l2));
    const px = w.x + dx * t;
    const pz = w.z + dz * t;
    const l = Math.sqrt(l2);
    // The side of the line it is on, or the left if right on it
    const side = Math.sign((u.x - px) * (-dz / l) + (u.z - pz) * (dx / l)) || 1;
    const out = s.width / 2 + CLEAR;
    return { x: px + (-dz / l) * side * out, z: pz + (dx / l) * side * out };
  }
  let reach = s.r;
  if (s.kind === 'square') {
    reach = s.r * Math.SQRT2;
  }
  const d = Math.hypot(u.x - w.x, u.z - w.z);
  // Right in the middle, it steps back the way it faces.
  const ax = d > 0.05 ? (u.x - w.x) / d : -Math.cos(u.angle);
  const az = d > 0.05 ? (u.z - w.z) / d : -Math.sin(u.angle);
  return { x: w.x + ax * (reach + CLEAR), z: w.z + az * (reach + CLEAR) };
}

/**
 * A merc in a warning meant for its side steps out of it, once it reacts:
 * as late as it would answer a shout, so a disciplined merc gets clear
 * where an unruly one is still swinging. Returns whether it is stepping.
 */
export default function sidestep(sim: Sim, u: Unit, dt: number): boolean {
  const w = sim.warnings.find(
    (x) => x.spare !== u.side && x.t >= responseDelay(u) && inside(x, u.x, u.z),
  );
  if (!w) {
    return false;
  }
  const to = outOf(w, u);
  const at = sim.clamp(to);
  u.travel(at.x, at.z, dt);
  return true;
}

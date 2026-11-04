import { isAloft } from '../../sim/flight';
import type Unit from '../../sim/unit';
import { type Pt, pt } from '../draw';
import { type Iso, type RigUnit, look } from '../rig';

// How high an aloft flyer hangs over its shadow, in design pixels, and how
// far it bobs
const LIFT = 14;
const BOB = 1.5;
// Design pixels per second the lift rises or falls
const RISE = 40;

// The lift each flyer has now, so it rises and drops rather than jumps.
const HEIGHT = new WeakMap<Unit, { h: number; at: number }>();

/** How far a unit is lifted off the floor right now, in design pixels. */
export function liftOf(u: Unit, time: number): number {
  const state = HEIGHT.get(u) ?? { h: isAloft(u) ? LIFT : 0, at: time };
  const want = isAloft(u) ? LIFT : 0;
  const step = Math.max(0, time - state.at) * RISE;
  state.h = state.h < want ? Math.min(want, state.h + step) : Math.max(want, state.h - step);
  state.at = time;
  HEIGHT.set(u, state);
  return state.h > 0 ? state.h + Math.sin(time * 4) * BOB : 0;
}

/** The same projection with every point raised by `lift` design pixels. */
export function lifted(iso: Iso, lift: number): Iso {
  return (x, z): Pt => {
    const p = iso(x, z);
    return pt(p.x, p.y - lift * look.zoom);
  };
}

/**
 * Draws a unit that may be aloft: a shadow on the ground and the figure
 * lifted over it. A unit on the ground is drawn as usual. No new figure.
 */
export function drawLifted(
  ctx: CanvasRenderingContext2D,
  u: Unit,
  r: RigUnit,
  iso: Iso,
  time: number,
  draw: (iso: Iso) => void,
): void {
  const lift = liftOf(u, time);
  if (lift <= 0) {
    draw(iso);
    return;
  }
  const base = iso(r.x, r.z);
  const z = look.zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 6 * z, 2 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  draw(lifted(iso, lift));
}

import type { HazardKind, Stage } from '../../gen/stage';
import { fillPoly } from '../draw';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import type { Iso } from '../rig';
import type { Scene } from './scene';

type Hazard = NonNullable<Stage['hazards']>[number];

/** Draws a hazard on the floor at its place, in frame pixels through `iso`. */
export type HazardLook = (ctx: CanvasRenderingContext2D, h: Hazard, iso: Iso) => void;

// A scorched fire vent: a dark ring edged in red, embers at its heart
const vent: HazardLook = (ctx, h, iso) => {
  const ring = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return iso(h.x + Math.cos(a) * 1.3, h.z + Math.sin(a) * 1.3);
  });
  fillPoly(ctx, ring, C.ink, C.blood);
  const c = iso(h.x, h.z);
  ctx.fillStyle = C.flame;
  ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 2);
};

/**
 * How each hazard looks, by hazard kind. A new kind adds one entry here.
 * Kinds without one are drawn as a fire vent.
 */
export const HAZARD_LOOKS: Partial<Record<HazardKind, HazardLook>> = {
  // An iron grate of spikes
  spikes: (ctx, h, iso) => {
    const r = 1.1;
    fillPoly(
      ctx,
      [iso(h.x - r, h.z - r), iso(h.x + r, h.z - r), iso(h.x + r, h.z + r), iso(h.x - r, h.z + r)],
      C.ink,
      C.stoneB,
    );
    ctx.fillStyle = C.bone;
    for (const [dx, dz] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
      [0, 0],
    ]) {
      const p = iso(h.x + dx, h.z + dz);
      ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 2);
    }
  },
  vent,
};

// A Labyrinth's traps, so they can be seen before they spring.
export function drawHazards(s: Scene, f: Frame, fog: Fogs): void {
  for (const h of f.areas.flatMap((a) => a.stage.hazards ?? [])) {
    if (!fog.known(h.x, h.z)) {
      continue;
    }
    (HAZARD_LOOKS[h.kind] ?? vent)(s.ctx, h, s.iso);
  }
}

import { type Stage, rectOf } from '../../gen/stage';
import { Side } from '../../sim/types';
import type { Light, Lighting } from '../light';
import type { Frame } from '../renderer';
import { propLight } from './props';
import { type Scene, focusOf, propsOf, tw } from './scene';

// How far the party sees: the bearer by the lantern, mercs by their own light.
const BEARER_SIGHT = 7;
const MERC_SIGHT = 4.5;
// How far the bearer's lantern lights the ground, in tiles
const LANTERN_LIGHT = 6.5;
// How much of the party's sight and light the Darkness mutator leaves
const DARK_SHARE = 0.5;
// Places lit through, and how far their light reaches from the middle
const LIT: ReadonlySet<Stage['kind']> = new Set(['guild', 'waystation', 'town', 'camp']);
const LIT_RADIUS = 13;

/** Who sees for the fog this frame: where, and how far, in tiles. */
export interface Viewer {
  x: number;
  z: number;
  radius: number;
}

// What the party sees from this frame. Solid props block sight; bodies do not.
export function viewersOf(f: Frame): Viewer[] {
  const viewers = f.sim.living(Side.Party).map((u) => {
    const r = f.views.rig(u, f.alpha);
    const radius = u === f.sim.bearer ? BEARER_SIGHT : MERC_SIGHT;
    return { x: r.x, z: r.z, radius: f.dark ? radius * DARK_SHARE : radius };
  });
  // The safe places are lit: the Guild House, Waystations, Towns and Camps.
  for (const { stage } of f.areas) {
    if (LIT.has(stage.kind)) {
      const r = rectOf(stage);
      viewers.push({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, radius: LIT_RADIUS });
    }
  }
  // Once the seal breaks, the lantern burns on in the Creditor's hand.
  const focus = focusOf(f);
  if (focus && focus !== f.sim.bearer) {
    viewers.push({ x: focus.x, z: focus.z, radius: BEARER_SIGHT });
  }
  return viewers;
}

// Warm lantern light in hard steps.
export function drawLight(s: Scene, f: Frame, lighting: Lighting): void {
  const lights: Light[] = [];
  const bearer = focusOf(f);
  // Flames flicker in their own pixels, not in the reach of their light:
  // a light whose edge moves every frame makes the whole floor crawl.
  const flicker = 0;
  if (bearer?.alive) {
    const b = f.views.rig(bearer, f.alpha);
    lights.push({
      x: b.x,
      z: b.z,
      radius: (f.dark ? LANTERN_LIGHT * DARK_SHARE : LANTERN_LIGHT) + flicker,
      color: [255, 196, 120],
      strength: 1.05,
    });
  }
  // Embers give a low red light over their ground.
  for (const p of f.areas.flatMap((a) => a.stage.patches ?? [])) {
    if (p.kind === 'embers') {
      lights.push({
        x: p.x,
        z: p.z,
        radius: p.r + 0.6 + flicker * 0.3,
        color: [255, 110, 60],
        strength: 0.4,
      });
    }
  }
  // Fires and candles, from each prop's look (see `PropLook.light`)
  for (const p of propsOf(f)) {
    const light = propLight(p);
    if (light) {
      lights.push(light);
    }
  }
  // Each merc carries a faint, cold light, so the party never disappears.
  for (const u of f.sim.living(Side.Party)) {
    if (u !== bearer) {
      const r = f.views.rig(u, f.alpha);
      lights.push({
        x: r.x,
        z: r.z,
        radius: 1.3,
        color: [190, 196, 210],
        strength: 0.35,
      });
    }
  }
  lighting.render([58, 60, 72], lights, s.iso, tw());
  s.ctx.save();
  s.ctx.globalCompositeOperation = 'multiply';
  s.ctx.drawImage(lighting.canvas, 0, 0);
  s.ctx.restore();
}

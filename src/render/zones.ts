import type { Zone } from '../sim/zone';
import type { Pt } from './draw';
import { C } from './palette';
import type { Iso } from './rig';

/**
 * Draws the mark that stands at a zone's middle, at `at`, a whole pixel.
 * The ring around it is drawn for every zone, in its element's color.
 */
export type ZoneLook = (ctx: CanvasRenderingContext2D, at: Pt, zone: Zone, iso: Iso) => void;

// A pole, with a flag or a spark at its top
const pole =
  (flag: string, w: number, h: number): ZoneLook =>
  (ctx, { x, y }) => {
    ctx.fillStyle = C.wood;
    ctx.fillRect(x, y - 16, 1, 16);
    ctx.fillStyle = flag;
    ctx.fillRect(x + 1, y - 16, w, h);
  };

/**
 * The mark of each skill's zone, by zone kind. A new zone kind adds one
 * entry here. Kinds without one get a small dot in the element's color.
 */
export const ZONE_LOOKS: Partial<Record<string, ZoneLook>> = {
  banner: pole(C.blood, 5, 4),
  lightningRod: pole(C.storm, 2, 2),
  // A straw dummy on a stake
  bait: (ctx, { x, y }) => {
    ctx.fillStyle = C.cloth;
    ctx.fillRect(x - 1, y - 9, 3, 7);
    ctx.fillRect(x - 3, y - 7, 7, 1);
    ctx.fillStyle = C.wood;
    ctx.fillRect(x, y - 2, 1, 2);
  },
  // Stones heaped into a short wall
  rampart: (ctx, { x, y }) => {
    ctx.fillStyle = C.stoneA;
    ctx.fillRect(x - 5, y - 4, 11, 4);
    ctx.fillStyle = C.stoneLine;
    ctx.fillRect(x - 5, y - 2, 11, 1);
  },
  // A slab of ice, standing where the wall is
  iceWall: (ctx, { x, y }) => {
    ctx.fillStyle = C.frost;
    ctx.fillRect(x - 6, y - 7, 13, 7);
    ctx.fillStyle = C.bone;
    ctx.fillRect(x - 6, y - 7, 13, 1);
  },
  // A crack in the ground, glowing
  volcano: (ctx, { x, y }) => {
    ctx.fillStyle = C.blood;
    ctx.fillRect(x - 4, y - 1, 9, 2);
    ctx.fillStyle = C.flame;
    ctx.fillRect(x - 2, y - 1, 5, 1);
  },
  // Spikes scattered over the field
  spikeField: (ctx, _at, z, iso) => {
    ctx.fillStyle = C.bone;
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const p = iso(z.x + Math.cos(a) * z.r * 0.6, z.z + Math.sin(a) * z.r * 0.6);
      ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 2);
    }
  },
};

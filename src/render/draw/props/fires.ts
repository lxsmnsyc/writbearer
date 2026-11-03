import { fillPoly, pt, quad } from '../../draw';
import { C } from '../../palette';
import { look } from '../../rig';
import { peg } from './shapes';
import type { PropLooks } from './types';

/** Fires: their shapes, the light they give and the flames drawn through the dark. */
const FIRE_PROPS: PropLooks = {
  torch: {
    draw: (ctx, _p, base) => {
      // A torch on a post, lighting the road on.
      fillPoly(
        ctx,
        [
          pt(base.x - 1, base.y),
          pt(base.x + 1, base.y),
          pt(base.x + 1, base.y - 28),
          pt(base.x - 1, base.y - 28),
        ],
        C.wood,
      );
    },
    // The fires at the exit burn bright, so the way on shows once found.
    light: (p) => ({ x: p.x, z: p.z, radius: 3.2, color: [255, 170, 90], strength: 0.8 }),
    flame: (ctx, p, b, time) => {
      const lick = Math.round(Math.sin(time * 11 + p.seed * 9));
      ctx.fillRect(b.x - 1, b.y - Math.round(30 * look.zoom), 3, 2);
      ctx.fillRect(b.x + lick, b.y - Math.round(33 * look.zoom), 1, 3);
    },
  },
  brazier: {
    draw: (ctx, _p, base) => {
      // An iron bowl on three legs. The fire is drawn after the light.
      fillPoly(
        ctx,
        [pt(base.x - 4, base.y), pt(base.x - 1, base.y - 10), pt(base.x - 3, base.y - 10)],
        C.ink,
        null,
      );
      fillPoly(
        ctx,
        [pt(base.x + 4, base.y), pt(base.x + 1, base.y - 10), pt(base.x + 3, base.y - 10)],
        C.ink,
        null,
      );
      fillPoly(
        ctx,
        [
          pt(base.x - 6, base.y - 14),
          pt(base.x + 6, base.y - 14),
          pt(base.x + 3, base.y - 9),
          pt(base.x - 3, base.y - 9),
        ],
        C.wood,
      );
    },
    light: (p) => ({ x: p.x, z: p.z, radius: 3.2, color: [255, 170, 90], strength: 0.8 }),
    flame: (ctx, p, b, time) => {
      const lick = Math.round(Math.sin(time * 11 + p.seed * 9) * 1.5);
      ctx.fillRect(b.x - 2, b.y - Math.round(16 * look.zoom), 4, 2);
      ctx.fillRect(b.x - 1 + lick, b.y - Math.round(19 * look.zoom), 2, 3);
    },
  },
  campfire: {
    draw: (ctx, _p, base) => {
      // Crossed logs in a ring of stones. The flames are drawn after the light.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillStyle = C.stoneA;
        ctx.fillRect(
          Math.round(base.x + Math.cos(a) * 8),
          Math.round(base.y + Math.sin(a) * 4),
          2,
          2,
        );
      }
      fillPoly(ctx, quad(pt(base.x - 6, base.y + 1), pt(base.x + 6, base.y - 2), 1.2, 1.2), C.wood);
      fillPoly(ctx, quad(pt(base.x - 5, base.y - 2), pt(base.x + 5, base.y + 1), 1.2, 1.2), C.wood);
    },
    light: (p) => ({ x: p.x, z: p.z, radius: 2.6, color: [255, 160, 80], strength: 0.75 }),
    flame: (ctx, _p, b, time) => {
      for (let i = 0; i < 3; i++) {
        const lick = Math.round(Math.sin(time * 9 + i * 2.1) * 1.5);
        ctx.fillRect(b.x - 2 + i * 2 + lick, b.y - Math.round((4 + i) * look.zoom), 1, 2 + i);
      }
    },
  },
  // A short pale candle, lit through the dark.
  candle: {
    draw: (ctx, _p, base) => {
      peg(ctx, base);
    },
    light: (p) => ({ x: p.x, z: p.z, radius: 1.6, color: [255, 180, 100], strength: 0.6 }),
    flame: (ctx, _p, b) => {
      ctx.fillRect(b.x, b.y - Math.round(8 * look.zoom), 1, 2);
    },
  },
};

export default FIRE_PROPS;

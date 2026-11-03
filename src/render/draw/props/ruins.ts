import { blob, fillPoly, hex, pt, quad } from '../../draw';
import { C } from '../../palette';
import { block } from './shapes';
import type { PropLooks } from './types';

/** Ruins and the dead: what stands in an open field or a sealing site. */
const RUIN_PROPS: PropLooks = {
  tree: {
    draw: (ctx, p, base) => {
      // A dead tree of the burned Marches: a bare, leaning trunk and a few
      // crooked limbs.
      const lean = (p.seed - 0.5) * 8;
      const top = pt(base.x + lean, base.y - 42 - p.seed * 16);
      for (let i = 0; i < 4; i++) {
        const t = 0.4 + i * 0.15;
        const from = pt(base.x + (top.x - base.x) * t, base.y + (top.y - base.y) * t);
        const side = (i + Math.round(p.seed * 3)) % 2 ? 1 : -1;
        const to = pt(from.x + side * (9 + ((p.seed * 13 + i * 5) % 7)), from.y - 9 - i * 2);
        fillPoly(ctx, quad(from, to, 1.4, 0.5), C.wood);
      }
      fillPoly(ctx, quad(base, top, 4, 1), C.wood);
      fillPoly(ctx, quad(base, pt(base.x - 7, base.y + 2), 1.5, 0.5), C.wood);
      fillPoly(ctx, quad(base, pt(base.x + 6, base.y + 3), 1.5, 0.5), C.wood);
    },
  },
  pillar: {
    draw: (ctx, _p, base) => {
      fillPoly(
        ctx,
        [
          pt(base.x - 7, base.y),
          pt(base.x + 7, base.y),
          pt(base.x + 7, base.y - 46),
          pt(base.x - 7, base.y - 46),
        ],
        C.stoneA,
      );
      fillPoly(
        ctx,
        [pt(base.x - 7, base.y - 46), pt(base.x + 7, base.y - 46), pt(base.x + 2, base.y - 52)],
        C.stoneA,
      );
    },
  },
  wall: {
    draw: (ctx, p, base) => {
      // A block of the ruined wall. Some stand tall, some are broken low.
      const h = 14 + Math.round(p.seed * 30);
      block(ctx, base, 0.5, h, p.seed);
    },
  },
  rubble: {
    draw: (ctx, p, base) => {
      const r = p.r ?? 0.5;
      block(ctx, pt(base.x - 4, base.y - 1), r * 0.6, 6 + p.seed * 6, p.seed);
      block(ctx, pt(base.x + 5, base.y + 2), r * 0.5, 4 + p.seed * 4, 1 - p.seed);
      block(ctx, pt(base.x, base.y + 4), r * 0.4, 3, p.seed * 0.5);
    },
  },
  gibbet: {
    draw: (ctx, _p, base, time) => {
      fillPoly(
        ctx,
        [
          pt(base.x - 2, base.y),
          pt(base.x + 2, base.y),
          pt(base.x + 2, base.y - 64),
          pt(base.x - 2, base.y - 64),
        ],
        C.wood,
      );
      fillPoly(
        ctx,
        [
          pt(base.x - 2, base.y - 64),
          pt(base.x + 24, base.y - 64),
          pt(base.x + 24, base.y - 60),
          pt(base.x - 2, base.y - 60),
        ],
        C.wood,
      );
      ctx.fillStyle = C.ink;
      ctx.fillRect(base.x + 20, base.y - 60, 1, 10);
      // The hanged offering sways a little and drips.
      const sway = Math.sin(time * 0.8) * 1.5;
      const h = pt(base.x + 20 + sway, base.y - 48);
      fillPoly(ctx, hex(h, 3), C.skin);
      fillPoly(
        ctx,
        [pt(h.x - 4, h.y + 3), pt(h.x + 4, h.y + 3), pt(h.x + 2, h.y + 16), pt(h.x - 2, h.y + 16)],
        C.skin,
      );
      fillPoly(
        ctx,
        quad(pt(h.x - 1, h.y + 16), pt(h.x - 1 - sway * 0.3, h.y + 28), 1, 0.6),
        C.skin,
      );
      fillPoly(
        ctx,
        quad(pt(h.x + 1, h.y + 16), pt(h.x + 2 - sway * 0.3, h.y + 28), 1, 0.6),
        C.skin,
      );
      ctx.fillStyle = C.blood;
      ctx.fillRect(Math.round(h.x), Math.round(h.y + 30 + ((time * 20) % 18)), 1, 2);
    },
  },
  pike: {
    draw: (ctx, _p, base) => {
      fillPoly(
        ctx,
        [
          pt(base.x - 1, base.y),
          pt(base.x + 1, base.y),
          pt(base.x + 1, base.y - 40),
          pt(base.x - 1, base.y - 40),
        ],
        C.wood,
      );
      fillPoly(ctx, hex(pt(base.x, base.y - 44), 4), C.skin);
      fillPoly(
        ctx,
        [pt(base.x - 3, base.y - 40), pt(base.x + 3, base.y - 40), pt(base.x, base.y - 30)],
        C.blood,
        null,
      );
    },
  },
  banner: {
    draw: (ctx, _p, base) => {
      // The Church's eye, watching over the seal.
      fillPoly(
        ctx,
        [
          pt(base.x - 1, base.y),
          pt(base.x + 1, base.y),
          pt(base.x + 1, base.y - 60),
          pt(base.x - 1, base.y - 60),
        ],
        C.wood,
      );
      const cloth = [
        pt(base.x + 1, base.y - 58),
        pt(base.x + 20, base.y - 56),
        pt(base.x + 19, base.y - 32),
        pt(base.x + 14, base.y - 36),
        pt(base.x + 10, base.y - 30),
        pt(base.x + 6, base.y - 35),
        pt(base.x + 1, base.y - 31),
      ];
      fillPoly(ctx, cloth, C.skin);
      ctx.fillStyle = C.bone;
      ctx.beginPath();
      ctx.ellipse(base.x + 10, base.y - 46, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.blood;
      ctx.fillRect(base.x + 9, base.y - 47, 2, 2);
    },
  },
  altar: {
    draw: (ctx, _p, base) => {
      const t = pt(base.x, base.y - 10);
      fillPoly(
        ctx,
        [
          pt(base.x - 14, base.y),
          pt(base.x, base.y + 7),
          pt(base.x + 14, base.y),
          pt(base.x + 14, base.y - 10),
          pt(base.x, base.y - 3),
          pt(base.x - 14, base.y - 10),
        ],
        C.stoneA,
      );
      fillPoly(
        ctx,
        [pt(t.x - 14, t.y), pt(t.x, t.y - 7), pt(t.x + 14, t.y), pt(t.x, t.y + 7)],
        C.bone,
      );
      fillPoly(ctx, blob(pt(t.x - 3, t.y), 7, 3), C.blood, null);
      fillPoly(ctx, hex(pt(t.x + 6, t.y - 1), 3, 0), C.gold);
    },
  },
  sarcophagus: {
    draw: (ctx, p, base) => {
      // The Creditor's sarcophagus: long, low and black, its lid sealed with
      // the Church's blood.
      block(ctx, base, 0.9, 12, p.seed, C.monster);
      fillPoly(
        ctx,
        [
          pt(base.x - 26, base.y - 12),
          pt(base.x, base.y - 25),
          pt(base.x + 26, base.y - 12),
          pt(base.x, base.y + 1),
        ],
        C.stoneB,
      );
      fillPoly(ctx, blob(pt(base.x, base.y - 12), 6, 3, 9, p.seed), C.blood, null);
    },
  },
};

export default RUIN_PROPS;

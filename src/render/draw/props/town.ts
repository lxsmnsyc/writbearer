import { fillPoly, pt, quad } from '../../draw';
import { C } from '../../palette';
import { block } from './shapes';
import type { PropLooks } from './types';

/** The Guild House, Towns and Waystations: buildings and the places to trade. */
const TOWN_PROPS: PropLooks = {
  signpost: {
    draw: (ctx, _p, base) => {
      // The Guild's waymark: a post with a board pointing east, down the road.
      fillPoly(
        ctx,
        [
          pt(base.x - 1, base.y),
          pt(base.x + 1, base.y),
          pt(base.x + 1, base.y - 34),
          pt(base.x - 1, base.y - 34),
        ],
        C.wood,
      );
      fillPoly(
        ctx,
        [
          pt(base.x - 4, base.y - 33),
          pt(base.x + 10, base.y - 26),
          pt(base.x + 13, base.y - 23),
          pt(base.x + 10, base.y - 21),
          pt(base.x - 4, base.y - 28),
        ],
        C.cloth,
      );
      ctx.fillStyle = C.gold;
      ctx.fillRect(base.x + 2, base.y - 28, 4, 1);
    },
  },
  post: {
    draw: (ctx, p, base) => {
      // The Guild's post: a plank hut under a pitched roof, its gold pennant
      // the only color in the field.
      block(ctx, base, 1.05, 30, p.seed, C.wood);
      fillPoly(
        ctx,
        [
          pt(base.x - 38, base.y - 28),
          pt(base.x, base.y - 52),
          pt(base.x + 38, base.y - 28),
          pt(base.x, base.y - 8),
        ],
        C.stoneB,
      );
      fillPoly(
        ctx,
        [
          pt(base.x - 1, base.y - 50),
          pt(base.x + 1, base.y - 50),
          pt(base.x + 1, base.y - 74),
          pt(base.x - 1, base.y - 74),
        ],
        C.wood,
      );
      fillPoly(
        ctx,
        [pt(base.x + 1, base.y - 74), pt(base.x + 16, base.y - 70), pt(base.x + 1, base.y - 65)],
        C.gold,
      );
      // The paymaster's window, lit from inside.
      ctx.fillStyle = C.flame;
      ctx.fillRect(base.x + 10, base.y - 12, 8, 5);
    },
  },
  strongbox: {
    draw: (ctx, _p, base) => {
      // The vault: the Guild's iron-bound strongbox.
      block(ctx, base, 0.38, 11, 0.5, C.stoneA);
      ctx.fillStyle = C.ink;
      ctx.fillRect(base.x - 12, base.y - 7, 24, 1);
      ctx.fillStyle = C.gold;
      ctx.fillRect(base.x - 1, base.y - 6, 3, 3);
    },
  },
  well: {
    draw: (ctx, p, base) => {
      // A round stone well with a winch over it.
      block(ctx, base, 0.55, 9, p.seed, C.stoneA);
      fillPoly(ctx, quad(pt(base.x - 10, base.y - 8), pt(base.x - 10, base.y - 24), 1, 1), C.wood);
      fillPoly(ctx, quad(pt(base.x + 10, base.y - 8), pt(base.x + 10, base.y - 24), 1, 1), C.wood);
      fillPoly(ctx, quad(pt(base.x - 11, base.y - 24), pt(base.x + 11, base.y - 24), 1, 1), C.wood);
    },
  },
  anvil: {
    draw: (ctx, p, base) => {
      // The smith's anvil on its stump, the forge glowing behind.
      block(ctx, pt(base.x + 6, base.y - 4), 0.35, 14, p.seed, C.stoneB);
      ctx.fillStyle = C.flame;
      ctx.fillRect(base.x + 3, base.y - 12, 5, 2);
      block(ctx, base, 0.2, 6, p.seed, C.wood);
      fillPoly(
        ctx,
        [
          pt(base.x - 7, base.y - 9),
          pt(base.x + 6, base.y - 9),
          pt(base.x + 4, base.y - 6),
          pt(base.x - 4, base.y - 6),
        ],
        C.ink,
      );
    },
  },
  bench: {
    draw: (ctx, p, base) => {
      // The Synthesis bench: a table of jars and a mortar.
      block(ctx, base, 0.45, 8, p.seed, C.wood);
      ctx.fillStyle = C.bone;
      ctx.fillRect(base.x - 6, base.y - 12, 2, 4);
      ctx.fillStyle = C.teal;
      ctx.fillRect(base.x - 1, base.y - 13, 2, 5);
      ctx.fillStyle = C.venom;
      ctx.fillRect(base.x + 4, base.y - 11, 2, 3);
    },
  },
  chapel: {
    draw: (ctx, p, base) => {
      // A small chapel of the old faith, before the Church went under.
      block(ctx, base, 1, 26, p.seed, C.stoneA);
      fillPoly(
        ctx,
        [
          pt(base.x - 34, base.y - 24),
          pt(base.x, base.y - 44),
          pt(base.x + 34, base.y - 24),
          pt(base.x, base.y - 6),
        ],
        C.stoneB,
      );
      fillPoly(ctx, quad(pt(base.x, base.y - 42), pt(base.x, base.y - 56), 1, 1), C.bone);
      fillPoly(ctx, quad(pt(base.x - 4, base.y - 52), pt(base.x + 4, base.y - 52), 1, 1), C.bone);
      ctx.fillStyle = C.flame;
      ctx.fillRect(base.x + 10, base.y - 14, 4, 6);
    },
  },
  stall: {
    draw: (ctx, p, base) => {
      // A market stall under an awning.
      block(ctx, base, 0.5, 8, p.seed, C.wood);
      fillPoly(ctx, quad(pt(base.x - 14, base.y - 6), pt(base.x - 14, base.y - 26), 1, 1), C.wood);
      fillPoly(ctx, quad(pt(base.x + 14, base.y - 6), pt(base.x + 14, base.y - 26), 1, 1), C.wood);
      fillPoly(
        ctx,
        [
          pt(base.x - 18, base.y - 24),
          pt(base.x + 18, base.y - 24),
          pt(base.x + 14, base.y - 32),
          pt(base.x - 14, base.y - 32),
        ],
        C.cloth,
      );
    },
  },
};

export default TOWN_PROPS;

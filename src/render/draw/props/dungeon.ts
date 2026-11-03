import { type Pt, fillPoly, pt } from '../../draw';
import { C } from '../../palette';
import { look } from '../../rig';
import { block } from './shapes';
import type { PropLooks } from './types';

/** Objective pieces: Labyrinth gates and levers, keys, vaults, chests, pits, stairs and blossoms. */
const DUNGEON_PROPS: PropLooks = {
  vault: {
    draw: (ctx, p, base) => {
      // A Vault's strongroom: a squat stone block bound in iron, its door
      // locked with gold until opened, then black.
      block(ctx, base, 1, 26, 0.5, C.stoneA);
      for (const y of [8, 18]) {
        fillPoly(
          ctx,
          [
            pt(base.x - 32, base.y - y),
            pt(base.x, base.y + 16 - y),
            pt(base.x, base.y + 14 - y),
            pt(base.x - 32, base.y - y - 2),
          ],
          C.ink,
        );
        fillPoly(
          ctx,
          [
            pt(base.x, base.y + 16 - y),
            pt(base.x + 32, base.y - y),
            pt(base.x + 32, base.y - y - 2),
            pt(base.x, base.y + 14 - y),
          ],
          C.ink,
        );
      }
      const door = [
        pt(base.x - 20, base.y + 6),
        pt(base.x - 10, base.y + 11),
        pt(base.x - 10, base.y - 6),
        pt(base.x - 20, base.y - 11),
      ];
      fillPoly(ctx, door, p.open === true ? C.void : C.wood, C.ink);
      if (p.open !== true) {
        ctx.fillStyle = C.gold;
        ctx.fillRect(base.x - 16, base.y - 2, 3, 3);
      }
    },
  },
  gate: {
    draw: (ctx, p, base) => {
      // Iron bars between the maze's walls. Open, only their stubs show.
      const h = p.open === true ? 2 : 22;
      for (const dx of [-3, 0, 3]) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(base.x + dx, base.y - h, 1, h);
      }
      if (p.open !== true) {
        ctx.fillStyle = C.stoneLine;
        ctx.fillRect(base.x - 4, base.y - h, 9, 1);
        ctx.fillRect(base.x - 4, base.y - 10, 9, 1);
      }
    },
  },
  lever: {
    draw: (ctx, p, base) => {
      // A lever in a stone socket, leaning one way until it is pulled.
      block(ctx, base, 0.25, 4, 0.5);
      const lean = p.open === true ? 5 : -5;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(base.x + 0.5, base.y - 4);
      ctx.lineTo(base.x + 0.5 + lean, base.y - 13);
      ctx.stroke();
      ctx.fillStyle = C.gold;
      ctx.fillRect(base.x + lean - 1, base.y - 15, 3, 3);
    },
  },
  key: {
    draw: (ctx, _p, base) => {
      // The hall's key on the floor, in gold.
      ctx.fillStyle = C.gold;
      ctx.fillRect(base.x - 3, base.y - 2, 3, 3);
      ctx.fillRect(base.x, base.y - 1, 4, 1);
      ctx.fillRect(base.x + 3, base.y, 1, 2);
    },
  },
  pit: {
    draw: (ctx, _p, base) => {
      // Where the floor fell in.
      const corner = (dx: number, dz: number): Pt =>
        pt(base.x + (dx - dz) * 16, base.y + (dx + dz) * 8);
      fillPoly(
        ctx,
        [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
        C.void,
        C.stoneLine,
      );
    },
  },
  chest: {
    draw: (ctx, _p, base) => {
      block(ctx, base, 0.32, 9, 0.5, C.wood);
      ctx.fillStyle = C.gold;
      ctx.fillRect(base.x - 1, base.y - 7, 2, 2);
    },
  },
  stair: {
    draw: (ctx, _p, base) => {
      // A dark opening with steps going down into it.
      const corner = (dx: number, dz: number): Pt =>
        pt(base.x + (dx - dz) * 16, base.y + (dx + dz) * 8);
      fillPoly(
        ctx,
        [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
        C.void,
        C.stoneLine,
      );
      for (let i = 0; i < 4; i++) {
        const t = -0.8 + i * 0.4;
        const a = corner(t, -0.9);
        const b = corner(t, 0.9);
        ctx.fillStyle = i % 2 ? C.stoneB : C.stoneA;
        ctx.fillRect(
          Math.round(Math.min(a.x, b.x)),
          Math.round(a.y + i * 1.5),
          Math.round(Math.abs(b.x - a.x)),
          1,
        );
      }
    },
  },
  blossom: {
    draw: (ctx, p, base) => {
      // A pale flower on a short stalk, its heart drawn after the light. Once
      // burst, a bent stalk and its petals on the ground.
      ctx.fillStyle = C.wood;
      if (p.open === true) {
        ctx.fillRect(base.x, base.y - 3, 1, 3);
        ctx.fillRect(base.x + 1, base.y - 4, 2, 1);
        ctx.fillStyle = C.cloth;
        for (const [dx, dy] of [
          [-4, 0],
          [3, 1],
          [-1, 2],
          [5, -1],
        ]) {
          ctx.fillRect(base.x + dx, base.y + dy, 1, 1);
        }
      } else {
        ctx.fillRect(base.x, base.y - 8, 1, 8);
        ctx.fillStyle = C.bone;
        for (const [dx, dy] of [
          [-3, -12],
          [1, -12],
          [-5, -10],
          [3, -10],
          [-2, -15],
          [-1, -9],
        ]) {
          ctx.fillRect(base.x + dx, base.y + dy, 3, 2);
        }
      }
    },
    // A blossom's heart glows, so it can be found in the dark.
    flame: (ctx, p, b) => {
      if (p.open === true) {
        return;
      }
      ctx.fillStyle = C.teal;
      ctx.fillRect(b.x - 1, b.y - Math.round(11 * look.zoom), 2, 2);
      ctx.fillStyle = C.flame;
    },
  },
};

export default DUNGEON_PROPS;

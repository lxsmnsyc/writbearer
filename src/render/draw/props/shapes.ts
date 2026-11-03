import { type Pt, fillPoly, pt } from '../../draw';
import { C } from '../../palette';

// A stone block on the floor: `r` tiles to each side, `h` pixels tall. Lit
// from the upper left: the top is lightest and the right face darkest.
export function block(
  ctx: CanvasRenderingContext2D,
  base: Pt,
  r: number,
  h: number,
  seed: number,
  color: string = C.stoneA,
): void {
  const left = pt(base.x - 32 * r, base.y);
  const right = pt(base.x + 32 * r, base.y);
  const front = pt(base.x, base.y + 16 * r);
  const back = pt(base.x, base.y - 16 * r);
  const up = (q: Pt): Pt => pt(q.x, q.y - h);
  // Broken tops lean a little, so no two blocks look alike.
  const tilt = (seed - 0.5) * 4;
  const top = [up(left), up(back), up(right), up(front)];
  top[0] = pt(top[0].x, top[0].y + tilt);
  top[2] = pt(top[2].x, top[2].y - tilt);
  fillPoly(ctx, [left, front, top[3], top[0]], C.stoneB);
  fillPoly(ctx, [front, right, top[2], top[3]], '#2c2c2c');
  fillPoly(ctx, top, color === C.stoneA ? '#4a4a4a' : color);
}

// A short pale peg: a candle, and any prop kind with no look of its own
export function peg(ctx: CanvasRenderingContext2D, base: Pt): void {
  fillPoly(
    ctx,
    [
      pt(base.x - 1, base.y),
      pt(base.x + 1, base.y),
      pt(base.x + 1, base.y - 6),
      pt(base.x - 1, base.y - 6),
    ],
    C.bone,
    null,
  );
}

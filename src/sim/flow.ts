import type { Rect, Spot } from './nav';

// An area's flow, after Left 4 Dead's: the distance a body walks from the
// entrance to every tile of its floor, around whatever blocks the way.
// Following it upward always leads on toward the exits. The level director
// uses it to tell what lies behind the party and what lies ahead.

// The cost of a step along an axis, and of one across a corner, in tenths
// of a tile, so a queue of buckets can order them
const STRAIGHT = 10;
const DIAGONAL = 14;
// The eight tiles round a tile
const NEIGHBOURS: readonly [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** Whether a body can stand at a point, as the world's nav says. */
export type Walkable = (x: number, z: number) => boolean;

export default class Flow {
  private readonly cols: number;
  private readonly rows: number;
  // Tenths of a tile walked to each tile, or -1 where none can be reached
  private readonly dist: Int32Array;
  /** The farthest any reachable tile is, in tiles. */
  readonly max: number;

  constructor(
    private readonly rect: Rect,
    from: Spot,
    walkable: Walkable,
  ) {
    this.cols = Math.max(1, Math.round(rect.x1 - rect.x0));
    this.rows = Math.max(1, Math.round(rect.z1 - rect.z0));
    const n = this.cols * this.rows;
    this.dist = new Int32Array(n).fill(-1);
    const open = new Uint8Array(n);
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        open[j * this.cols + i] = walkable(rect.x0 + i + 0.5, rect.z0 + j + 0.5) ? 1 : 0;
      }
    }
    const start = this.index(from);
    if (start < 0) {
      this.max = 0;
      return;
    }
    open[start] = 1;
    // Buckets by distance: each step adds 10 or 14, so every tile is settled
    // in order without a heap.
    const buckets: number[][] = [[start]];
    this.dist[start] = 0;
    let most = 0;
    for (let d = 0; d < buckets.length; d++) {
      for (const k of buckets[d] ?? []) {
        if (this.dist[k] === d) {
          most = d;
          this.spread(k, d, open, buckets);
        }
      }
    }
    this.max = most / STRAIGHT;
  }

  // Steps from a settled tile to each open neighbour it reaches sooner.
  private spread(k: number, d: number, open: Uint8Array, buckets: number[][]): void {
    const i = k % this.cols;
    const j = Math.floor(k / this.cols);
    for (const [di, dj] of NEIGHBOURS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= this.cols || nj >= this.rows) {
        continue;
      }
      const nk = nj * this.cols + ni;
      // Across a corner only where both sides of it are open
      const corner = di !== 0 && dj !== 0;
      const cut = corner && (!open[j * this.cols + ni] || !open[nj * this.cols + i]);
      const nd = d + (corner ? DIAGONAL : STRAIGHT);
      if (open[nk] && !cut && (this.dist[nk] < 0 || nd < this.dist[nk])) {
        this.dist[nk] = nd;
        (buckets[nd] ??= []).push(nk);
      }
    }
  }

  private index(p: Spot): number {
    const i = Math.floor(p.x - this.rect.x0);
    const j = Math.floor(p.z - this.rect.z0);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) {
      return -1;
    }
    return j * this.cols + i;
  }

  /**
   * How far a body walks from the entrance to a point, in tiles, or
   * Infinity if it cannot. A point whose tile's middle is blocked, beside a
   * tree say, takes its nearest reachable neighbour's, a step on.
   */
  at(p: Spot): number {
    const k = this.index(p);
    if (k < 0) {
      return Infinity;
    }
    if (this.dist[k] >= 0) {
      return this.dist[k] / STRAIGHT;
    }
    const i = k % this.cols;
    const j = Math.floor(k / this.cols);
    let best = Infinity;
    for (const [di, dj] of NEIGHBOURS) {
      const ni = i + di;
      const nj = j + dj;
      const d =
        ni >= 0 && nj >= 0 && ni < this.cols && nj < this.rows
          ? this.dist[nj * this.cols + ni]
          : -1;
      if (d >= 0) {
        best = Math.min(best, (d + STRAIGHT) / STRAIGHT);
      }
    }
    return best;
  }

  /** How far along a point is, from 0 at the entrance to 1 at the farthest tile. */
  progress(p: Spot): number {
    const d = this.at(p);
    return Number.isFinite(d) && this.max > 0 ? Math.min(1, d / this.max) : 0;
  }
}

/** A point on the floor, in tiles. */
export interface Spot {
  x: number;
  z: number;
}

/** A rectangle of floor, from (x0, z0) to (x1, z1), in tiles. */
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Whether a point lies inside a rectangle. */
export const inRect = (r: Rect, p: Spot): boolean =>
  p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

/** The smallest rectangle holding every one of them. */
export const unionOf = (rects: readonly Rect[]): Rect => ({
  x0: Math.min(...rects.map((r) => r.x0)),
  z0: Math.min(...rects.map((r) => r.z0)),
  x1: Math.max(...rects.map((r) => r.x1)),
  z1: Math.max(...rects.map((r) => r.z1)),
});

// Cells per tile along each axis.
const RES = 2;
// Room a body needs beside an obstacle, in tiles.
const CLEARANCE = 0.25;
// A search gives up after this many cells, and the unit walks straight.
const MAX_SEARCH = 8000;
const SQRT2 = Math.SQRT2;

// A binary min-heap of cells by priority.
class Heap {
  private readonly keys: number[] = [];
  private readonly prios: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, prio: number): void {
    const { keys, prios } = this;
    let i = keys.length;
    keys.push(key);
    prios.push(prio);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (prios[p] <= prios[i]) {
        break;
      }
      [keys[p], keys[i]] = [keys[i], keys[p]];
      [prios[p], prios[i]] = [prios[i], prios[p]];
      i = p;
    }
  }

  pop(): number {
    const { keys, prios } = this;
    const top = keys[0];
    const lastKey = keys.pop()!;
    const lastPrio = prios.pop()!;
    if (keys.length > 0) {
      keys[0] = lastKey;
      prios[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < keys.length && prios[l] < prios[m]) {
          m = l;
        }
        if (r < keys.length && prios[r] < prios[m]) {
          m = r;
        }
        if (m === i) {
          break;
        }
        [keys[m], keys[i]] = [keys[i], keys[m]];
        [prios[m], prios[i]] = [prios[i], prios[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Where units can walk: a grid of half tiles, blocked around obstacles.
 * Units walk straight when nothing is in the way, and follow an A* path
 * when something is.
 */
export default class Nav {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;
  // Where the grid's first cell starts
  private readonly x0: number;
  private readonly z0: number;

  /**
   * A grid over `width` by `depth` tiles from (x0, z0). With `floor`, only
   * the cells inside one of its rectangles can be stood on, as when areas
   * join edge to edge.
   */
  constructor(
    readonly width: number,
    readonly depth: number,
    obstacles: readonly { x: number; z: number; r: number }[],
    frame: { x0?: number; z0?: number; floor?: readonly Rect[] } = {},
  ) {
    this.x0 = frame.x0 ?? 0;
    this.z0 = frame.z0 ?? 0;
    this.cols = Math.ceil(width * RES);
    this.rows = Math.ceil(depth * RES);
    this.blocked = new Uint8Array(this.cols * this.rows);
    const floor = frame.floor;
    if (floor) {
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          const at = this.center(j * this.cols + i);
          if (!floor.some((r) => inRect(r, at))) {
            this.blocked[j * this.cols + i] = 1;
          }
        }
      }
    }
    for (const o of obstacles) {
      const r = o.r + CLEARANCE;
      const i0 = Math.max(0, Math.floor((o.x - r - this.x0) * RES));
      const i1 = Math.min(this.cols - 1, Math.floor((o.x + r - this.x0) * RES));
      const j0 = Math.max(0, Math.floor((o.z - r - this.z0) * RES));
      const j1 = Math.min(this.rows - 1, Math.floor((o.z + r - this.z0) * RES));
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const c = this.center(j * this.cols + i);
          if (Math.hypot(c.x - o.x, c.z - o.z) < r) {
            this.blocked[j * this.cols + i] = 1;
          }
        }
      }
    }
  }

  /** Whether a body can stand at a point. */
  walkable(x: number, z: number): boolean {
    const k = this.cell(x, z);
    return k >= 0 && this.blocked[k] === 0;
  }

  /** Whether a body can walk straight from one point to the other. */
  clear(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / 0.2);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) {
        return false;
      }
    }
    return true;
  }

  /**
   * A walkable route from one point toward another, as waypoints, ending at
   * the goal or the nearest walkable cell to it. Empty if there is none.
   */
  path(from: Spot, to: Spot): Spot[] {
    const start = this.nearestOpen(this.cell(from.x, from.z));
    const goal = this.nearestOpen(this.cell(to.x, to.z));
    if (start < 0 || goal < 0) {
      return [];
    }
    const cells = this.search(start, goal);
    if (cells.length === 0) {
      return [];
    }
    const points = cells.map((k) => this.center(k));
    if (this.walkable(to.x, to.z)) {
      points[points.length - 1] = { x: to.x, z: to.z };
    }
    return this.smooth(from, points);
  }

  // A* over the grid, 8 ways, without cutting corners.
  private search(start: number, goal: number): number[] {
    const { cols } = this;
    const n = this.blocked.length;
    const g = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open = new Heap();
    const gi = goal % cols;
    const gj = Math.floor(goal / cols);
    const h = (k: number): number => {
      const dx = Math.abs((k % cols) - gi);
      const dz = Math.abs(Math.floor(k / cols) - gj);
      return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
    };
    g[start] = 0;
    open.push(start, h(start));
    let searched = 0;
    while (open.size > 0 && searched < MAX_SEARCH) {
      const k = open.pop();
      if (k === goal) {
        const out: number[] = [];
        for (let c = goal; c !== -1; c = came[c]) {
          out.push(c);
        }
        return out.reverse();
      }
      if (closed[k]) {
        continue;
      }
      closed[k] = 1;
      searched++;
      const i = k % cols;
      const j = Math.floor(k / cols);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if ((di === 0 && dj === 0) || !this.open(i + di, j + dj)) {
            continue;
          }
          // A diagonal step needs both sides open, so bodies do not clip corners.
          if (di !== 0 && dj !== 0 && (!this.open(i + di, j) || !this.open(i, j + dj))) {
            continue;
          }
          const next = (j + dj) * cols + i + di;
          const cost = g[k] + (di !== 0 && dj !== 0 ? SQRT2 : 1);
          if (cost < g[next]) {
            g[next] = cost;
            came[next] = k;
            open.push(next, cost + h(next));
          }
        }
      }
    }
    return [];
  }

  // Drops waypoints that can be skipped by walking straight.
  private smooth(from: Spot, points: Spot[]): Spot[] {
    const out: Spot[] = [];
    let at = from;
    let i = 0;
    while (i < points.length) {
      let far = i;
      while (
        far + 1 < points.length &&
        this.clear(at.x, at.z, points[far + 1].x, points[far + 1].z)
      ) {
        far++;
      }
      out.push(points[far]);
      at = points[far];
      i = far + 1;
    }
    return out;
  }

  private open(i: number, j: number): boolean {
    return (
      i >= 0 && j >= 0 && i < this.cols && j < this.rows && this.blocked[j * this.cols + i] === 0
    );
  }

  // The closest open cell to a cell, searching outward ring by ring.
  private nearestOpen(k: number): number {
    if (k < 0) {
      return -1;
    }
    if (this.blocked[k] === 0) {
      return k;
    }
    const i0 = k % this.cols;
    const j0 = Math.floor(k / this.cols);
    for (let r = 1; r < 12; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) === r && this.open(i0 + di, j0 + dj)) {
            return (j0 + dj) * this.cols + i0 + di;
          }
        }
      }
    }
    return -1;
  }

  private cell(x: number, z: number): number {
    const i = Math.floor((x - this.x0) * RES);
    const j = Math.floor((z - this.z0) * RES);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) {
      return -1;
    }
    return j * this.cols + i;
  }

  private center(k: number): Spot {
    return {
      x: this.x0 + ((k % this.cols) + 0.5) / RES,
      z: this.z0 + (Math.floor(k / this.cols) + 0.5) / RES,
    };
  }
}

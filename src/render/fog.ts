import type { Pt } from './draw';

export interface Viewer {
  x: number;
  z: number;
  // How far it sees, in tiles
  radius: number;
}

export interface Blocker {
  x: number;
  z: number;
  r: number;
}

// Cells per tile along each axis.
const RES = 4;
// How dark remembered ground is, and how fast cells fade in and out, per second.
const MEMORY = 0.62;
const FADE = 6;

/**
 * Fog of war on a grid of quarter tiles. The party sees around itself, and
 * pillars and other solid props block its sight. Ground it has seen stays
 * dimly remembered; ground it has never seen is black.
 *
 * The fog is drawn on the floor, under everything that stands, and standing
 * things are hidden or dimmed by the cell they stand on. So it never covers a
 * figure in front of it, the way a screen-wide overlay would.
 */
export default class Fog {
  private readonly n: number;
  // How visible each cell is now, 0 to 1, eased toward what the party sees
  private readonly vis: Float32Array;
  private readonly seen: Uint8Array;
  private readonly target: Uint8Array;

  constructor(readonly size: number) {
    this.n = size * RES;
    this.vis = new Float32Array(this.n * this.n);
    this.seen = new Uint8Array(this.n * this.n);
    this.target = new Uint8Array(this.n * this.n);
  }

  update(dt: number, viewers: Viewer[], blockers: Blocker[]): void {
    const { n, target, seen, vis } = this;
    target.fill(0);
    for (const v of viewers) {
      // Only blockers within reach can cut its sight.
      const near = blockers.filter((b) => Math.hypot(b.x - v.x, b.z - v.z) < v.radius + b.r);
      const x0 = Math.max(0, Math.floor((v.x - v.radius) * RES));
      const x1 = Math.min(n - 1, Math.ceil((v.x + v.radius) * RES));
      const z0 = Math.max(0, Math.floor((v.z - v.radius) * RES));
      const z1 = Math.min(n - 1, Math.ceil((v.z + v.radius) * RES));
      for (let i = x0; i <= x1; i++) {
        for (let j = z0; j <= z1; j++) {
          const k = i * n + j;
          if (target[k]) {
            continue;
          }
          const cx = (i + 0.5) / RES;
          const cz = (j + 0.5) / RES;
          if (Math.hypot(cx - v.x, cz - v.z) <= v.radius && clear(v.x, v.z, cx, cz, near)) {
            target[k] = 1;
            seen[k] = 1;
          }
        }
      }
    }
    const step = Math.min(1, dt * FADE);
    for (let k = 0; k < vis.length; k++) {
      vis[k] += (target[k] - vis[k]) * step;
    }
  }

  /** How visible a floor point is now, 0 to 1. */
  visible(x: number, z: number): number {
    const k = this.cell(x, z);
    return k < 0 ? 0 : this.vis[k];
  }

  /** Whether the party has ever seen a floor point. */
  known(x: number, z: number): boolean {
    const k = this.cell(x, z);
    return k >= 0 && this.seen[k] === 1;
  }

  /**
   * Whether the party sees any part of a solid thing. Its own centre is
   * inside it, so look at the ring around it instead.
   */
  visibleAround(x: number, z: number, r: number): number {
    let best = this.visible(x, z);
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      best = Math.max(best, this.visible(x + Math.cos(t) * (r + 0.2), z + Math.sin(t) * (r + 0.2)));
    }
    return best;
  }

  knownAround(x: number, z: number, r: number): boolean {
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      if (this.known(x + Math.cos(t) * (r + 0.2), z + Math.sin(t) * (r + 0.2))) {
        return true;
      }
    }
    return this.known(x, z);
  }

  /** Darkens the floor: black where unknown, dim where only remembered. */
  draw(ctx: CanvasRenderingContext2D, iso: (x: number, z: number) => Pt, void_: string): void {
    const { n, seen, vis } = this;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = i * n + j;
        const v = vis[k];
        if (v > 0.98) {
          continue;
        }
        const x = i / RES;
        const z = j / RES;
        const c = iso(x + 0.5 / RES, z + 0.5 / RES);
        if (c.x < -16 || c.x > w + 16 || c.y < -16 || c.y > h + 16) {
          continue;
        }
        if (seen[k]) {
          ctx.fillStyle = `rgba(0,0,0,${(1 - v) * MEMORY})`;
        } else {
          ctx.fillStyle = void_;
        }
        const d = 1 / RES;
        const a = iso(x, z);
        const b = iso(x + d, z);
        const e = iso(x + d, z + d);
        const f = iso(x, z + d);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 0.5);
        ctx.lineTo(b.x + 0.5, b.y);
        ctx.lineTo(e.x, e.y + 0.5);
        ctx.lineTo(f.x - 0.5, f.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private cell(x: number, z: number): number {
    const i = Math.floor(x * RES);
    const j = Math.floor(z * RES);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) {
      return -1;
    }
    return i * this.n + j;
  }
}

// Whether the segment from (ax, az) to (bx, bz) misses every blocker.
function clear(ax: number, az: number, bx: number, bz: number, blockers: Blocker[]): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  for (const o of blockers) {
    // Blockers right beside the viewer do not blind it.
    if (Math.hypot(o.x - ax, o.z - az) <= o.r) {
      continue;
    }
    // Cells inside the blocker itself are not hidden by it.
    if (Math.hypot(o.x - bx, o.z - bz) <= o.r) {
      continue;
    }
    const t = len2 ? Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / len2)) : 0;
    const px = ax + dx * t - o.x;
    const pz = az + dz * t - o.z;
    if (px * px + pz * pz < o.r * o.r) {
      return false;
    }
  }
  return true;
}

import RNG from '../core/rng';
import type { Pt } from './draw';

interface Mote {
  x: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  vh: number;
}

const MOTES = 110;

/**
 * Low fog, drifting ash and film grain. Fog and ash are drawn before the
 * light, so they only show where light reaches. Grain is drawn after.
 */
export default class Atmosphere {
  private readonly fog: HTMLCanvasElement;
  private readonly grain: HTMLCanvasElement;
  private readonly motes: Mote[] = [];
  private readonly rng = new RNG(4242);

  constructor(
    private readonly w: number,
    private readonly h: number,
  ) {
    this.fog = cloud(w * 2, h * 2, this.rng);
    this.grain = noise(w, h, this.rng);
  }

  update(dt: number, cx: number, cz: number): void {
    // Keep motes in a box around the camera, and respawn the ones that leave.
    while (this.motes.length < MOTES) {
      this.motes.push(this.spawn(cx, cz));
    }
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.x += m.vx * dt;
      m.z += m.vz * dt;
      m.h += m.vh * dt;
      if (m.h > 3 || Math.abs(m.x - cx) > 9 || Math.abs(m.z - cz) > 9) {
        this.motes[i] = this.spawn(cx, cz);
      }
    }
  }

  private spawn(cx: number, cz: number): Mote {
    const r = this.rng;
    return {
      x: cx + r.range(-8, 8),
      z: cz + r.range(-8, 8),
      h: r.range(0, 2.5),
      vx: r.range(0.05, 0.25),
      vz: r.range(-0.15, 0.05),
      vh: r.range(0.05, 0.2),
    };
  }

  /** Fog and ash, before the light is applied. */
  drawLit(
    ctx: CanvasRenderingContext2D,
    iso: (x: number, z: number) => Pt,
    time: number,
    zoom: number,
  ): void {
    const drift = (time * 4) % this.w;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(this.fog, -drift, -this.h * 0.3 + Math.sin(time * 0.2) * 6);
    ctx.drawImage(this.fog, this.w * 2 - drift, -this.h * 0.3 + Math.sin(time * 0.2) * 6);
    ctx.restore();
    ctx.fillStyle = '#b4b0a8';
    for (const m of this.motes) {
      const p = iso(m.x, m.z);
      ctx.fillRect(Math.round(p.x), Math.round(p.y - m.h * 16 * zoom), 1, 1);
    }
  }

  /** Grain and the vignette, after the light. */
  drawAfter(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.drawImage(this.grain, -this.rng.int(0, 7), -this.rng.int(0, 7));
    ctx.restore();
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.35,
      this.w / 2,
      this.h / 2,
      this.w * 0.62,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}

// Soft cloud shapes for fog: many faint blobs on a dark canvas.
function cloud(w: number, h: number, rng: RNG): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 70; i++) {
    const x = rng.range(0, w);
    const y = rng.range(h * 0.2, h);
    const r = rng.range(20, 70);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(150,150,150,0.35)');
    g.addColorStop(1, 'rgba(150,150,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

function noise(w: number, h: number, rng: RNG): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w + 8;
  c.height = h + 8;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng.chance(0.5) ? 255 : 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

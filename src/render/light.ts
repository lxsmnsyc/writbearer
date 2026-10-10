import type { Pt } from './draw';

export interface Light {
  x: number;
  z: number;
  // Reach in tiles
  radius: number;
  // RGB, 0 to 255
  color: [number, number, number];
  // How bright the brightest step is, 0 to 1
  strength: number;
}

// Light falls off in hard steps, not a smooth gradient, so pixel art does
// not speckle. Each step is a fraction of the radius.
const STEPS = [1, 0.74, 0.5, 0.28];

/**
 * A screen-sized light map. The scene is multiplied by it: dark where no
 * light reaches, warm where the lantern does. It casts no shadows: a
 * screen-wide map has no depth, so shadows would fall across figures that
 * stand in front of them. Fog of war does the hiding instead.
 */
export class Lighting {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layer: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;

  constructor(w: number, h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.layer = document.createElement('canvas');
    this.layer.width = w;
    this.layer.height = h;
    this.lctx = this.layer.getContext('2d')!;
  }

  render(
    ambient: [number, number, number],
    lights: Light[],
    iso: (x: number, z: number) => Pt,
    tileWidth: number,
  ): void {
    const { ctx, lctx, layer } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgb(${ambient[0]},${ambient[1]},${ambient[2]})`;
    ctx.fillRect(0, 0, w, h);

    for (const light of lights) {
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, w, h);
      const c = iso(light.x, light.z);
      const step = light.strength / STEPS.length;
      const [r, g, b] = light.color;
      lctx.fillStyle = `rgba(${r},${g},${b},${step})`;
      for (const k of STEPS) {
        // Light reaches a little higher than the floor, so standing figures
        // near the edge are lit to the head.
        const rx = light.radius * k * tileWidth * 0.75;
        lctx.beginPath();
        lctx.ellipse(c.x, c.y - rx * 0.12, rx, rx * 0.62, 0, 0, Math.PI * 2);
        lctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(layer, 0, 0);
    }
  }
}

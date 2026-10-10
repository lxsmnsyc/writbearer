import type { Prop, Stage } from '../game/stage';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';
import { type Pt, blob, fillPoly, hex, pt, quad } from './draw';
import { type Effects, drawPiece } from './effects';
import { C, quantize } from './palette';
import { drawUnit, emissives } from './rig';
import type { Views } from './view';

// The frame is drawn small and scaled up with no smoothing.
export const W = 384;
export const H = 216;
export const SCALE = 3;
// A tile is 32 by 16 pixels on screen.
const TW = 32;
const TH = 16;

export interface Frame {
  sim: Sim;
  stage: Stage;
  views: Views;
  effects: Effects;
  // How far between the last tick and the next, 0 to 1
  alpha: number;
  time: number;
  slain: number;
  over: boolean;
}

export default class Renderer {
  private readonly out: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly small: HTMLCanvasElement;
  private readonly mask: CanvasRenderingContext2D;
  private readonly maskCanvas: HTMLCanvasElement;
  private readonly cam = { x: 0, y: 0 };
  private camReady = false;

  constructor(private readonly screen: HTMLCanvasElement) {
    screen.width = W * SCALE;
    screen.height = H * SCALE;
    this.out = screen.getContext('2d')!;
    this.out.imageSmoothingEnabled = false;
    this.small = document.createElement('canvas');
    this.small.width = W;
    this.small.height = H;
    this.ctx = this.small.getContext('2d', { willReadFrequently: true })!;
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = W;
    this.maskCanvas.height = H;
    this.mask = this.maskCanvas.getContext('2d')!;
  }

  readonly iso = (x: number, z: number): Pt =>
    pt(Math.round((x - z) * (TW / 2) - this.cam.x), Math.round((x + z) * (TH / 2) - this.cam.y));

  /** The floor point under a spot on the screen element, in tiles. */
  unproject(clientX: number, clientY: number): { x: number; z: number } {
    const r = this.screen.getBoundingClientRect();
    const X = ((clientX - r.left) / r.width) * W + this.cam.x;
    const Y = ((clientY - r.top) / r.height) * H + this.cam.y;
    const a = (2 * X) / TW;
    const b = (2 * Y) / TH;
    return { x: (a + b) / 2, z: (b - a) / 2 };
  }

  render(f: Frame): void {
    const { ctx, iso } = this;
    const bearer = f.sim.bearer;
    if (bearer) {
      // The camera follows the bearer, snapped to whole pixels.
      const b = f.views.rig(bearer, f.alpha);
      const tx = (b.x - b.z) * (TW / 2) - W / 2;
      const ty = (b.x + b.z) * (TH / 2) - H / 2;
      const k = this.camReady ? 0.12 : 1;
      this.camReady = true;
      this.cam.x = Math.round(this.cam.x + (tx - this.cam.x) * k);
      this.cam.y = Math.round(this.cam.y + (ty - this.cam.y) * k);
    }

    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    this.drawFloor(f.stage);
    this.drawSigil(f.stage);
    f.effects.drawDecals(ctx, iso);
    for (const p of f.effects.pieces) {
      if (p.h === 0) {
        drawPiece(ctx, iso, p);
      }
    }

    // Everything that stands, sorted back to front.
    const list: { depth: number; draw: () => void }[] = [];
    for (const p of f.stage.props) {
      list.push({
        depth: p.x + p.z,
        draw: () => {
          this.drawProp(p, iso(p.x, p.z), f.time);
        },
      });
    }
    for (const u of f.sim.units) {
      if (u.alive) {
        const r = f.views.rig(u, f.alpha);
        list.push({
          depth: r.x + r.z,
          draw: () => {
            drawUnit(ctx, r, iso, C, f.time, f.views.get(u).hurt < 0.12);
          },
        });
      }
    }
    for (const p of f.effects.pieces) {
      if (p.h > 0) {
        list.push({
          depth: p.x + p.z,
          draw: () => {
            drawPiece(ctx, iso, p);
          },
        });
      }
    }
    list.sort((a, b) => a.depth - b.depth);
    for (const item of list) {
      item.draw();
    }
    f.effects.drawAir(ctx, iso);

    this.drawDarkness(f);
    this.drawGlow(f);
    this.drawHealth(f);
    quantize(ctx, W, H);

    this.out.drawImage(this.small, 0, 0, W * SCALE, H * SCALE);
    this.drawHud(f);
  }

  private drawFloor(stage: Stage): void {
    for (let x = 0; x < stage.size; x++) {
      for (let z = 0; z < stage.size; z++) {
        const c = this.iso(x + 0.5, z + 0.5);
        if (c.x < -20 || c.x > W + 20 || c.y < -20 || c.y > H + 20) {
          continue;
        }
        const tile = [
          this.iso(x, z),
          this.iso(x + 1, z),
          this.iso(x + 1, z + 1),
          this.iso(x, z + 1),
        ];
        fillPoly(this.ctx, tile, (x * 3 + z) % 2 ? C.stoneA : C.stoneB, C.stoneLine);
      }
    }
  }

  // The Church's sealing sigil, painted in blood on the floor.
  private drawSigil(stage: Stage): void {
    const { ctx } = this;
    const sc = this.iso(stage.sigil.x, stage.sigil.z);
    ctx.strokeStyle = C.blood;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sc.x, sc.y, 52, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    [0, 2, 4, 1, 3].forEach((i, k) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const q = pt(sc.x + Math.cos(a) * 46, sc.y + Math.sin(a) * 23);
      if (k) {
        ctx.lineTo(q.x, q.y);
      } else {
        ctx.moveTo(q.x, q.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
  }

  private drawProp(p: Prop, base: Pt, time: number): void {
    const { ctx } = this;
    if (p.kind === 'pillar') {
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
    } else if (p.kind === 'gibbet') {
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
    } else if (p.kind === 'pike') {
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
    } else if (p.kind === 'banner') {
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
    } else if (p.kind === 'altar') {
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
    } else {
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
  }

  // Darkness, with hard rings of light: soft gradients speckle in pixel art.
  private drawDarkness(f: Frame): void {
    const { mask } = this;
    mask.globalCompositeOperation = 'source-over';
    mask.clearRect(0, 0, W, H);
    mask.fillStyle = 'rgba(0,0,0,0.66)';
    mask.fillRect(0, 0, W, H);
    mask.globalCompositeOperation = 'destination-out';
    const ring = (c: Pt, r: number, a: number): void => {
      mask.fillStyle = `rgba(0,0,0,${a})`;
      mask.beginPath();
      mask.ellipse(c.x, c.y, r, r * 0.6, 0, 0, Math.PI * 2);
      mask.fill();
    };
    const flicker = Math.sin(f.time * 9) * 1.5;
    const bearer = f.sim.bearer;
    if (bearer?.alive) {
      const b = f.views.rig(bearer, f.alpha);
      const lp = this.iso(b.x, b.z);
      ring(lp, 92 + flicker, 0.3);
      ring(lp, 64 + flicker, 0.35);
      ring(lp, 38 + flicker, 0.5);
    }
    for (const p of f.stage.props) {
      if (p.kind === 'candle') {
        ring(this.iso(p.x, p.z), 14, 0.4);
      }
    }
    // Each merc carries a faint light, so the party never disappears.
    for (const u of f.sim.living(Side.Party)) {
      if (u !== bearer) {
        const r = f.views.rig(u, f.alpha);
        ring(this.iso(r.x, r.z), 14, 0.35);
      }
    }
    this.ctx.drawImage(this.maskCanvas, 0, 0);
  }

  // Eyes, growths and flames are drawn after the darkness, so they shine through it.
  private drawGlow(f: Frame): void {
    const { ctx } = this;
    for (const u of f.sim.living()) {
      for (const e of emissives(f.views.rig(u, f.alpha), this.iso, f.time)) {
        if (e.color === 'teal') {
          ctx.fillStyle = C.teal;
        } else if (e.color === 'blood') {
          ctx.fillStyle = C.blood;
        } else {
          ctx.fillStyle = C.flame;
        }
        const size = e.color === 'flame' ? 2 : 1;
        ctx.fillRect(Math.round(e.p.x) - (size >> 1), Math.round(e.p.y) - (size >> 1), size, size);
      }
    }
    ctx.fillStyle = C.flame;
    for (const p of f.stage.props) {
      if (p.kind === 'candle') {
        const b = this.iso(p.x, p.z);
        ctx.fillRect(b.x, b.y - 8, 1, 2);
      }
    }
  }

  // Health bars: gold for the party, red for monsters.
  private drawHealth(f: Frame): void {
    const { ctx } = this;
    for (const u of f.sim.living()) {
      if (u.side === Side.Party && u.hp >= u.derived.maxHp) {
        continue;
      }
      if (u.side === Side.Monster && !u.aware) {
        continue;
      }
      const r = f.views.rig(u, f.alpha);
      const b = this.iso(r.x, r.z);
      const y = b.y - barHeight(u);
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x - 7, y, 14, 2);
      ctx.fillStyle = u.side === Side.Party ? C.gold : C.blood;
      ctx.fillRect(b.x - 7, y, Math.max(0, Math.round((14 * u.hp) / u.derived.maxHp)), 2);
    }
  }

  private drawHud(f: Frame): void {
    const { out } = this;
    out.font = '16px ui-monospace, monospace';
    out.fillStyle = '#9a9a9a';
    out.textAlign = 'start';
    out.fillText('WASD or click to move the bearer.  R to restart.', 16, 26);
    out.fillText(`Slain: ${f.slain}`, W * SCALE - 120, 26);
    if (f.over) {
      out.fillStyle = 'rgba(0,0,0,0.6)';
      out.fillRect(0, 0, W * SCALE, H * SCALE);
      out.fillStyle = C.blood;
      out.font = '36px ui-serif, Georgia, serif';
      out.textAlign = 'center';
      out.fillText('The bearer has fallen.', (W * SCALE) / 2, (H * SCALE) / 2);
      out.font = '16px ui-monospace, monospace';
      out.fillStyle = '#9a9a9a';
      out.fillText('Press R to draw another lot.', (W * SCALE) / 2, (H * SCALE) / 2 + 36);
      out.textAlign = 'start';
    }
  }
}

function barHeight(u: Unit): number {
  if (u.kind === 'bearer') {
    return 36;
  }
  if (u.kind === 'crawler') {
    return 16;
  }
  return 44;
}

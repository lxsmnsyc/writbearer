import type { Prop, Stage } from '../gen/stage';
import { BURN, CHILL, DREAD, FREEZE, PETRIFY, POISON, SHOCK, STUN, TAUNTED } from '../sim/statuses';
import type Sim from '../sim/sim';
import { Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { type Pt, blob, fillPoly, hex, pt, quad } from './draw';
import Atmosphere from './atmosphere';
import { type Effects, drawPiece } from './effects';
import { type FloorImage, buildFloor } from './floor';
import Fog from './fog';
import { type Light, Lighting } from './light';
import { C, quantize } from './palette';
import { drawUnit, emissives, look } from './rig';
import type { Views } from './view';

// The frame is drawn small and scaled up with no smoothing.
export const W = 384;
export const H = 216;
export const SCALE = 3;
// A tile is 32 by 16 pixels on screen, times the zoom.
const TW = 32;
const TH = 16;
const tw = (): number => TW * look.zoom;
const th = (): number => TH * look.zoom;
// How far the party sees: the bearer by the lantern, mercs by their own light.
const BEARER_SIGHT = 7;
const MERC_SIGHT = 4.5;

// Each status's color: its element's, or bone for plain ones like Stun.
const STATUS_COLOR: Record<string, string> = {
  [TAUNTED.id]: C.blood,
  [STUN.id]: C.bone,
  [BURN.id]: C.flame,
  [CHILL.id]: C.frost,
  [FREEZE.id]: C.frost,
  [SHOCK.id]: C.storm,
  [PETRIFY.id]: C.earth,
  [POISON.id]: C.venom,
  [DREAD.id]: C.teal,
};

// Statuses that build up, by id, to read their thresholds.
const BUILDUP_STATUS = new Map(
  [STUN, BURN, CHILL, SHOCK, PETRIFY, POISON, DREAD].map((def) => [def.id, def]),
);

export interface Frame {
  sim: Sim;
  stage: Stage;
  views: Views;
  effects: Effects;
  // How far between the last tick and the next, 0 to 1
  alpha: number;
  time: number;
  slain: number;
  // Which stage of the descent this is, from 1
  depth: number;
  over: boolean;
  paused: boolean;
  // The merc whose orders are open
  selected: Unit | null;
  // Screen shake in pixels, from heavy hits
  shake: number;
}

export default class Renderer {
  private readonly out: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly small: HTMLCanvasElement;
  private readonly cam = { x: 0, y: 0 };
  private readonly jolt = { x: 0, y: 0 };
  private camReady = false;
  private readonly lighting = new Lighting(W, H);
  private readonly atmosphere = new Atmosphere(W, H);
  private floor: { stage: Stage; zoom: number; image: FloorImage } | null = null;
  private fog: { stage: Stage; fog: Fog } | null = null;
  private readonly scratch: CanvasRenderingContext2D;

  constructor(private readonly screen: HTMLCanvasElement) {
    screen.width = W * SCALE;
    screen.height = H * SCALE;
    this.out = screen.getContext('2d')!;
    this.out.imageSmoothingEnabled = false;
    this.small = document.createElement('canvas');
    this.small.width = W;
    this.small.height = H;
    this.ctx = this.small.getContext('2d', { willReadFrequently: true })!;
    const scratch = document.createElement('canvas');
    scratch.width = W;
    scratch.height = H;
    this.scratch = scratch.getContext('2d')!;
  }

  readonly iso = (x: number, z: number): Pt =>
    pt(
      Math.round((x - z) * (tw() / 2) - this.cam.x - this.jolt.x),
      Math.round((x + z) * (th() / 2) - this.cam.y - this.jolt.y),
    );

  /** A point on the screen element, in the small frame's pixels. */
  toSmall(clientX: number, clientY: number): Pt {
    const r = this.screen.getBoundingClientRect();
    return pt(((clientX - r.left) / r.width) * W, ((clientY - r.top) / r.height) * H);
  }

  /** The floor point under a spot on the screen element, in tiles. */
  unproject(clientX: number, clientY: number): { x: number; z: number } {
    const s = this.toSmall(clientX, clientY);
    const X = s.x + this.cam.x;
    const Y = s.y + this.cam.y;
    const a = (2 * X) / tw();
    const b = (2 * Y) / th();
    return { x: (a + b) / 2, z: (b - a) / 2 };
  }

  render(f: Frame): void {
    const { ctx, iso } = this;
    const z = look.zoom;
    const bearer = f.sim.bearer;
    if (bearer) {
      // The camera follows the bearer, snapped to whole pixels.
      const b = f.views.rig(bearer, f.alpha);
      const tx = (b.x - b.z) * (tw() / 2) - W / 2;
      const ty = (b.x + b.z) * (th() / 2) - H / 2;
      const k = this.camReady ? 0.12 : 1;
      this.camReady = true;
      this.cam.x = Math.round(this.cam.x + (tx - this.cam.x) * k);
      this.cam.y = Math.round(this.cam.y + (ty - this.cam.y) * k);
    }
    this.jolt.x = f.shake > 0 ? Math.round((Math.random() * 2 - 1) * f.shake) : 0;
    this.jolt.y = f.shake > 0 ? Math.round((Math.random() * 2 - 1) * f.shake) : 0;

    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    this.drawStoneFloor(f);
    for (const s of f.stage.sigils) {
      this.drawSigil(s);
    }
    f.effects.drawDecals(ctx, iso);
    for (const p of f.effects.pieces) {
      if (p.h === 0) {
        drawPiece(ctx, iso, p);
      }
    }
    // Fog covers the floor only. Standing things are hidden by their own cell below.
    const fog = this.updateFog(f);
    fog.draw(ctx, iso, C.void, this.floorOnScreen());
    f.effects.drawRings(ctx, iso);

    // A gold ring marks the merc whose orders are open.
    if (f.selected?.alive) {
      const r = f.views.rig(f.selected, f.alpha);
      const b = iso(r.x, r.z);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 10 * z, 4 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Everything that stands, sorted back to front.
    const list: { depth: number; draw: () => void }[] = [];
    for (const p of f.stage.props) {
      const b = iso(p.x, p.z);
      // Props stay where they were seen, dimmed while out of sight.
      if (!onScreen(b) || !fog.knownAround(p.x, p.z, p.r ?? 0.3)) {
        continue;
      }
      const dim = (1 - fog.visibleAround(p.x, p.z, p.r ?? 0.3)) * 0.62;
      list.push({
        depth: p.x + p.z,
        draw: () => {
          this.dimmed(dim, b, (c) => {
            // Props are drawn in design pixels, scaled to the zoom.
            c.save();
            c.translate(b.x, b.y);
            c.scale(z, z);
            drawProp(c, p, pt(0, 0), f.time);
            c.restore();
          });
        },
      });
    }
    for (const u of f.sim.units) {
      // The dead stay where they fell, unless they were torn apart.
      if (u.alive || !f.effects.gibbed.has(u)) {
        const r = f.views.rig(u, f.alpha);
        const shown = seen(fog, u, r.x, r.z);
        if (shown <= 0.05) {
          continue;
        }
        list.push({
          depth: r.x + r.z,
          draw: () => {
            ctx.globalAlpha = shown;
            drawUnit(ctx, r, iso, C, f.time, f.views.get(u).hurt < 0.12);
            ctx.globalAlpha = 1;
          },
        });
      }
    }
    for (const p of f.effects.pieces) {
      if (p.h > 0 && fog.visible(p.x, p.z) > 0.5) {
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
    f.effects.drawAir(ctx, iso, (px, pz) => fog.visible(px, pz) > 0.5);

    if (bearer) {
      const b = f.views.rig(bearer, f.alpha);
      this.atmosphere.update(f.paused ? 0 : 1 / 60, b.x, b.z);
      this.atmosphere.drawLit(ctx, iso, f.time, z);
    }
    this.drawLight(f);
    this.drawGlow(f, fog);
    this.atmosphere.drawAfter(ctx);
    this.drawHealth(f, fog);
    // The light has hard steps of its own, so it needs little dither.
    quantize(ctx, W, H, 3);

    this.out.drawImage(this.small, 0, 0, W * SCALE, H * SCALE);
    this.drawHud(f);
  }

  // What the party sees this frame. Solid props block sight; bodies do not.
  private updateFog(f: Frame): Fog {
    if (this.fog?.stage !== f.stage) {
      this.fog = { stage: f.stage, fog: new Fog(f.stage.width, f.stage.depth) };
    }
    const viewers = f.sim.living(Side.Party).map((u) => {
      const r = f.views.rig(u, f.alpha);
      return { x: r.x, z: r.z, radius: u === f.sim.bearer ? BEARER_SIGHT : MERC_SIGHT };
    });
    this.fog.fog.update(f.paused ? 0 : 1 / 60, viewers, f.sim.obstacles);
    return this.fog.fog;
  }

  /** The camera jumps to the bearer on the next frame instead of gliding. */
  snapCamera(): void {
    this.camReady = false;
  }

  // The floor area on screen, in tiles, for drawing only what can be seen.
  private floorOnScreen(): { x0: number; x1: number; z0: number; z1: number } {
    const corners = [
      [0, 0],
      [W, 0],
      [0, H],
      [W, H],
    ].map(([sx, sy]) => {
      const X = sx + this.cam.x + this.jolt.x;
      const Y = sy + this.cam.y + this.jolt.y;
      const a = (2 * X) / tw();
      const b = (2 * Y) / th();
      return { x: (a + b) / 2, z: (b - a) / 2 };
    });
    return {
      x0: Math.min(...corners.map((c) => c.x)) - 1,
      x1: Math.max(...corners.map((c) => c.x)) + 1,
      z0: Math.min(...corners.map((c) => c.z)) - 1,
      z1: Math.max(...corners.map((c) => c.z)) + 1,
    };
  }

  // Draws a prop at `at` darkened by `amount`, without darkening what is
  // behind it. Only the box around the prop is touched.
  private dimmed(amount: number, at: Pt, draw: (ctx: CanvasRenderingContext2D) => void): void {
    if (amount < 0.02) {
      draw(this.ctx);
      return;
    }
    const z = look.zoom;
    const x = Math.floor(at.x - 48 * z);
    const y = Math.floor(at.y - 96 * z);
    const w = Math.ceil(96 * z);
    const h = Math.ceil(124 * z);
    const s = this.scratch;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(x, y, w, h);
    draw(s);
    s.globalCompositeOperation = 'source-atop';
    s.fillStyle = `rgba(0,0,0,${amount})`;
    s.fillRect(x, y, w, h);
    this.ctx.drawImage(s.canvas, x, y, w, h, x, y, w, h);
  }

  // The worn stone floor, drawn once per stage and zoom, then copied.
  private drawStoneFloor(f: Frame): void {
    if (this.floor?.stage !== f.stage || this.floor.zoom !== look.zoom) {
      this.floor = { stage: f.stage, zoom: look.zoom, image: buildFloor(f.stage, look.zoom, 1234) };
    }
    const { image } = this.floor;
    const origin = this.iso(0, 0);
    this.ctx.drawImage(image.canvas, origin.x - image.ox, origin.y - image.oy);
  }

  // Warm lantern light in hard steps.
  private drawLight(f: Frame): void {
    const lights: Light[] = [];
    const bearer = f.sim.bearer;
    const flicker = Math.sin(f.time * 9) * 0.08 + Math.sin(f.time * 23) * 0.04;
    if (bearer?.alive) {
      const b = f.views.rig(bearer, f.alpha);
      lights.push({
        x: b.x,
        z: b.z,
        radius: 6.5 + flicker,
        color: [255, 196, 120],
        strength: 1.05,
      });
    }
    for (const p of f.stage.props) {
      if (p.kind === 'candle') {
        lights.push({
          x: p.x,
          z: p.z,
          radius: 1.6,
          color: [255, 180, 100],
          strength: 0.6,
        });
      } else if (p.kind === 'brazier') {
        // The braziers by the stair burn bright, so the way down shows once found.
        lights.push({
          x: p.x,
          z: p.z,
          radius: 3.2 + flicker,
          color: [255, 170, 90],
          strength: 0.8,
        });
      }
    }
    // Each merc carries a faint, cold light, so the party never disappears.
    for (const u of f.sim.living(Side.Party)) {
      if (u !== bearer) {
        const r = f.views.rig(u, f.alpha);
        lights.push({
          x: r.x,
          z: r.z,
          radius: 1.3,
          color: [190, 196, 210],
          strength: 0.35,
        });
      }
    }
    this.lighting.render([58, 60, 72], lights, this.iso, tw());
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'multiply';
    this.ctx.drawImage(this.lighting.canvas, 0, 0);
    this.ctx.restore();
  }

  // The Church's sealing sigil, painted in blood on the floor.
  private drawSigil(at: { x: number; z: number }): void {
    const { ctx } = this;
    const sc = this.iso(at.x, at.z);
    ctx.strokeStyle = C.blood;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const z = look.zoom;
    ctx.lineWidth = z;
    ctx.ellipse(sc.x, sc.y, 52 * z, 26 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    [0, 2, 4, 1, 3].forEach((i, k) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const q = pt(sc.x + Math.cos(a) * 46 * z, sc.y + Math.sin(a) * 23 * z);
      if (k) {
        ctx.lineTo(q.x, q.y);
      } else {
        ctx.moveTo(q.x, q.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
  }

  // Eyes, growths and flames are drawn after the darkness, so they shine through it.
  private drawGlow(f: Frame, fog: Fog): void {
    const { ctx } = this;
    for (const u of f.sim.living()) {
      const r = f.views.rig(u, f.alpha);
      if (seen(fog, u, r.x, r.z) < 0.5) {
        continue;
      }
      this.drawStatuses(u, r.x, r.z, f.time);
      for (const e of emissives(r, this.iso, f.time)) {
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
      if (p.kind === 'candle' && fog.known(p.x, p.z)) {
        const b = this.iso(p.x, p.z);
        ctx.fillRect(b.x, b.y - Math.round(8 * look.zoom), 1, 2);
      } else if (p.kind === 'brazier' && fog.known(p.x, p.z)) {
        const b = this.iso(p.x, p.z);
        const lick = Math.round(Math.sin(f.time * 11 + p.seed * 9) * 1.5);
        ctx.fillRect(b.x - 2, b.y - Math.round(16 * look.zoom), 4, 2);
        ctx.fillRect(b.x - 1 + lick, b.y - Math.round(19 * look.zoom), 2, 3);
      }
    }
  }

  // Marks for each status, in its element's color. They shine through the dark.
  private drawStatuses(u: Unit, x: number, z: number, time: number): void {
    const { ctx } = this;
    const b = this.iso(x, z);
    const top = b.y - Math.round((barHeight(u) + 5) * look.zoom);
    for (const s of u.statuses.values()) {
      const color = STATUS_COLOR[s.def.id] ?? C.bone;
      ctx.fillStyle = color;
      if (s.def.id === TAUNTED.id) {
        // A red notch over the head: this one has turned on the Vanguard.
        ctx.fillRect(b.x - 1, top - 3, 2, 3);
        ctx.fillRect(b.x - 1, top + 1, 2, 1);
      } else if (s.def.disables) {
        // Three motes circling the head.
        for (let i = 0; i < 3; i++) {
          const a = time * 5 + (i * Math.PI * 2) / 3;
          ctx.fillRect(
            Math.round(b.x + Math.cos(a) * 5),
            Math.round(top + 4 + Math.sin(a) * 2),
            1,
            1,
          );
        }
      } else if (s.def.slow) {
        // Frost settles at the feet.
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(b.x - 5 + i * 3, b.y + (i % 2), 1, 1);
        }
      } else {
        // Embers or bubbles rise off the body.
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.9 + i / 3) % 1;
          const px = b.x + Math.round(Math.sin(i * 2.3 + time) * 4);
          const py = Math.round(b.y - (8 + t * (barHeight(u) - 6)) * look.zoom);
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }

  // Health bars: gold for the party, red for monsters. Under them, a thin
  // bar in an element's color fills as a status builds up.
  private drawBuildup(u: Unit, bx: number, y: number): void {
    let best: { id: string; share: number } | null = null;
    for (const [id, value] of u.buildup) {
      const def = BUILDUP_STATUS.get(id);
      const limit = def?.threshold?.(u) ?? 0;
      if (limit > 0 && (!best || value / limit > best.share)) {
        best = { id, share: value / limit };
      }
    }
    if (!best) {
      return;
    }
    this.ctx.fillStyle = C.ink;
    this.ctx.fillRect(bx - 7, y + 2, 14, 1);
    this.ctx.fillStyle = STATUS_COLOR[best.id] ?? C.bone;
    this.ctx.fillRect(bx - 7, y + 2, Math.max(1, Math.round(14 * best.share)), 1);
  }

  // Health bars: gold for the party, red for monsters.
  private drawHealth(f: Frame, fog: Fog): void {
    const { ctx } = this;
    for (const u of f.sim.living()) {
      if (u.side === Side.Party && u.hp >= u.derived.maxHp && u.buildup.size === 0) {
        continue;
      }
      if (u.side === Side.Monster && !u.aware) {
        continue;
      }
      const r = f.views.rig(u, f.alpha);
      if (seen(fog, u, r.x, r.z) < 0.5) {
        continue;
      }
      const b = this.iso(r.x, r.z);
      const y = b.y - Math.round(barHeight(u) * look.zoom);
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x - 7, y, 14, 2);
      ctx.fillStyle = u.side === Side.Party ? C.gold : C.blood;
      ctx.fillRect(b.x - 7, y, Math.max(0, Math.round((14 * u.hp) / u.derived.maxHp)), 2);
      this.drawBuildup(u, b.x, y);
    }
  }

  private drawHud(f: Frame): void {
    const { out } = this;
    out.font = '20px "IM Fell English", Georgia, serif';
    out.fillStyle = '#b9b0a0';
    out.textAlign = 'start';
    out.fillText(
      'WASD or click to move.  Click a merc, or 1 and 2, for orders.  R to restart.',
      16,
      26,
    );
    out.fillText(`Depth ${f.depth} · Slain: ${f.slain}`, W * SCALE - 210, 26);
    out.fillStyle = '#8a8274';
    out.fillText('Find the stair down, to the east.', 16, 52);
    if (f.over) {
      out.fillStyle = 'rgba(0,0,0,0.6)';
      out.fillRect(0, 0, W * SCALE, H * SCALE);
      out.fillStyle = C.blood;
      out.font = '44px "IM Fell English SC", Georgia, serif';
      out.textAlign = 'center';
      out.fillText('The bearer has fallen.', (W * SCALE) / 2, (H * SCALE) / 2);
      out.font = '16px ui-monospace, monospace';
      out.fillStyle = '#9a9a9a';
      out.fillText('Press R to draw another lot.', (W * SCALE) / 2, (H * SCALE) / 2 + 36);
      out.textAlign = 'start';
    }
  }
}

// Whether a floor point's screen spot is near enough the frame to draw what stands there.
function onScreen(b: Pt): boolean {
  return b.x > -64 && b.x < W + 64 && b.y > -24 && b.y < H + 120;
}

function barHeight(u: Unit): number {
  const elite = u.rank === Rank.Normal ? 1 : 1.25;
  if (u.kind === 'bearer') {
    return 36;
  }
  if (u.kind === 'crawler') {
    return 16 * elite;
  }
  if (u.kind === 'hollowed') {
    return 38 * elite;
  }
  return 44 * elite;
}

// How visible a unit is, 0 to 1. The party is always seen.
function seen(fog: Fog, u: Unit, x: number, z: number): number {
  if (u.side === Side.Party) {
    return 1;
  }
  return fog.visible(x, z);
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop, base: Pt, time: number): void {
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
    fillPoly(ctx, quad(pt(h.x - 1, h.y + 16), pt(h.x - 1 - sway * 0.3, h.y + 28), 1, 0.6), C.skin);
    fillPoly(ctx, quad(pt(h.x + 1, h.y + 16), pt(h.x + 2 - sway * 0.3, h.y + 28), 1, 0.6), C.skin);
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
  } else if (p.kind === 'wall') {
    // A block of the ruined wall. Some stand tall, some are broken low.
    const h = 14 + Math.round(p.seed * 30);
    block(ctx, base, 0.5, h, p.seed);
  } else if (p.kind === 'rubble') {
    const r = p.r ?? 0.5;
    block(ctx, pt(base.x - 4, base.y - 1), r * 0.6, 6 + p.seed * 6, p.seed);
    block(ctx, pt(base.x + 5, base.y + 2), r * 0.5, 4 + p.seed * 4, 1 - p.seed);
    block(ctx, pt(base.x, base.y + 4), r * 0.4, 3, p.seed * 0.5);
  } else if (p.kind === 'chest') {
    block(ctx, base, 0.32, 9, 0.5, C.wood);
    ctx.fillStyle = C.gold;
    ctx.fillRect(base.x - 1, base.y - 7, 2, 2);
  } else if (p.kind === 'stair') {
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
  } else if (p.kind === 'brazier') {
    // An iron bowl on three legs. The fire is drawn after the light.
    fillPoly(
      ctx,
      [pt(base.x - 4, base.y), pt(base.x - 1, base.y - 10), pt(base.x - 3, base.y - 10)],
      C.ink,
      null,
    );
    fillPoly(
      ctx,
      [pt(base.x + 4, base.y), pt(base.x + 1, base.y - 10), pt(base.x + 3, base.y - 10)],
      C.ink,
      null,
    );
    fillPoly(
      ctx,
      [
        pt(base.x - 6, base.y - 14),
        pt(base.x + 6, base.y - 14),
        pt(base.x + 3, base.y - 9),
        pt(base.x - 3, base.y - 9),
      ],
      C.wood,
    );
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

// A stone block on the floor: `r` tiles to each side, `h` pixels tall. Lit
// from the upper left: the top is lightest and the right face darkest.
function block(
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

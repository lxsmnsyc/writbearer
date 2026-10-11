import type { Ahead, Prop, Stage } from '../gen/stage';
import { itemName } from '../gen/loot';
import type { GroundItem } from '../game/inventory';
import type { Offer } from '../content/recruits';
import { ItemType, Quality } from '../sim/item';
import {
  BURN,
  CHILL,
  DREAD,
  FREEZE,
  PETRIFY,
  POISON,
  ROOTED,
  SHOCK,
  STUN,
  SUNDERED,
  TAUNTED,
} from '../sim/statuses';
import type Sim from '../sim/sim';
import { Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { type Pt, blob, fillPoly, hex, pt, quad } from './draw';
import Atmosphere, { drawVignette } from './atmosphere';
import { type Effects, drawPiece } from './effects';
import { areaOf, layerOf } from '../gen/layers';
import { Shout } from '../sim/shout';
import { type FloorImage, buildFloor } from './floor';
import Fog from './fog';
import { type Light, Lighting } from './light';
import { C, quantize } from './palette';
import { drawUnit, emissives, isKind, look } from './rig';
import type { Views } from './view';

// The frame is drawn small and scaled up with no smoothing.
export const W = 384;
export const H = 216;
export const SCALE = 3;

// How a run ends, as the last screen says it.
const ENDING: Record<'fallen' | 'sealed' | 'risen', [string, string]> = {
  fallen: ['The bearer has fallen.', 'The Writ lies where it fell, for the Guild to send again.'],
  sealed: ['The Creditor is sealed again.', 'The bearer dies with it. The run is cleared.'],
  risen: ['The Creditor rises.', 'Every merc is dead. The run is lost.'],
};

// What lies beyond a road on, as its signpost reads.
const AHEAD_NAME: Record<Exclude<Ahead, 'down'>, string> = {
  combat: 'Fight',
  elite: 'Elite: a strong pack, better spoils',
  camp: 'Camp: rest by a fire',
  boss: 'The walled ring',
};

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
  [ROOTED.id]: C.bone,
};

// Statuses that build up, by id, to read their thresholds.
const BUILDUP_STATUS = new Map(
  [STUN, BURN, CHILL, SHOCK, PETRIFY, POISON, DREAD].map((def) => [def.id, def]),
);

// The glint over an item on the floor, by quality. Plain items have none.
const QUALITY_COLOR: Partial<Record<Quality, string>> = {
  [Quality.Superior]: C.bone,
  [Quality.Magic]: C.teal,
  [Quality.Rare]: C.gold,
};

/** Label colors by quality: grey for crude, white for plain, teal for magic, gold for rare. */
export const LABEL_COLOR: Record<Quality, string> = {
  [Quality.Inferior]: '#7a7a7a',
  [Quality.Normal]: '#cfcac0',
  [Quality.Superior]: '#ffffff',
  [Quality.Magic]: '#5fd4c0',
  [Quality.Rare]: '#d9a845',
};

// The height of an item's floor label, in screen pixels.
const LABEL_HEIGHT = 18;

export interface Frame {
  sim: Sim;
  stage: Stage;
  views: Views;
  effects: Effects;
  // How far between the last tick and the next, 0 to 1
  alpha: number;
  time: number;
  slain: number;
  // Items lying on the floor
  ground: GroundItem[];
  // A merc for hire waiting by its fire, if the stage has one
  wanderer: { offer: Offer; x: number; z: number } | null;
  over: boolean;
  paused: boolean;
  // The merc whose orders are open
  selected: Unit | null;
  // Screen shake in pixels, from heavy hits
  shake: number;
  // The boss of a layer's last area, if the party is there
  boss: Unit | null;
  // A line shown under the hint for a while, such as who left unpaid
  notice: string | null;
  // The bearer's shout, shown over its head for a moment
  callout: string | null;
  // How the final fight ended: the Creditor sealed again, or risen
  ending: 'sealed' | 'risen' | null;
}

// What the camera and the lantern follow: the bearer, or once the seal
// breaks, the Creditor in its body.
const focusOf = (f: Frame): Unit | null => f.sim.bearer ?? (f.stage.tomb ? f.boss : null);

export default class Renderer {
  private readonly out: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly small: HTMLCanvasElement;
  // The camera in frame pixels: `cam` is the whole part the frame is drawn
  // at, and `sub` the rest, in screen pixels, applied when the frame is
  // scaled up. So the view glides a third of a frame pixel at a time instead
  // of stepping a whole one, with a stall every few frames.
  private readonly cam = { x: 0, y: 0 };
  private readonly sub = { x: 0, y: 0 };
  private readonly glide = { x: 0, y: 0 };
  private readonly jolt = { x: 0, y: 0 };
  private camReady = false;
  // Where each item's floor label was drawn this frame, in screen pixels
  private readonly labels: { item: GroundItem; x: number; y: number; w: number }[] = [];
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

  /**
   * The item whose floor label is under a point on the screen element, if
   * any. Labels are what the player clicks to pick something up.
   */
  labelAt(clientX: number, clientY: number): GroundItem | null {
    const r = this.screen.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W * SCALE;
    const py = ((clientY - r.top) / r.height) * H * SCALE;
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      if (Math.abs(px - l.x) <= l.w / 2 && py >= l.y - 14 && py <= l.y - 14 + LABEL_HEIGHT) {
        return l.item;
      }
    }
    return null;
  }

  /** A point on the screen element, in the small frame's pixels. */
  toSmall(clientX: number, clientY: number): Pt {
    const r = this.screen.getBoundingClientRect();
    return pt(
      ((clientX - r.left) / r.width) * W + this.sub.x / SCALE,
      ((clientY - r.top) / r.height) * H + this.sub.y / SCALE,
    );
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
    // The camera follows the bearer, or what it became.
    const bearer = focusOf(f);
    if (bearer) {
      // The camera follows the bearer, snapped to whole screen pixels.
      const b = f.views.rig(bearer, f.alpha);
      const tx = (b.x - b.z) * (tw() / 2) - W / 2;
      const ty = (b.x + b.z) * (th() / 2) - H / 2;
      const k = this.camReady ? 0.12 : 1;
      this.camReady = true;
      this.glide.x += (tx - this.glide.x) * k;
      this.glide.y += (ty - this.glide.y) * k;
      const sx = Math.round(this.glide.x * SCALE);
      const sy = Math.round(this.glide.y * SCALE);
      this.cam.x = Math.floor(sx / SCALE);
      this.cam.y = Math.floor(sy / SCALE);
      this.sub.x = sx - this.cam.x * SCALE;
      this.sub.y = sy - this.cam.y * SCALE;
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
    this.drawGround(f, fog);
    f.effects.drawRings(ctx, iso);
    this.drawTraps(f);

    // A red ring marks the enemy the bearer told the party to focus on.
    const focused = new Set(
      f.sim
        .living(Side.Party)
        .map((m) => (m.heard?.shout === Shout.Focus ? m.heard.target : null))
        .filter((t) => t?.alive),
    );
    for (const t of focused) {
      if (t) {
        const r = f.views.rig(t, f.alpha);
        const b = iso(r.x, r.z);
        ctx.strokeStyle = C.blood;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 12 * z, 5 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

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
    const w = f.wanderer;
    if (w && fog.visible(w.x, w.z) > 0.05 && isKind(w.offer.kind)) {
      const kind = w.offer.kind;
      // It turns to watch the bearer come.
      const angle = bearer ? Math.atan2(bearer.z - w.z, bearer.x - w.x) : Math.PI;
      list.push({
        depth: w.x + w.z,
        draw: () => {
          ctx.globalAlpha = fog.visible(w.x, w.z);
          drawUnit(
            ctx,
            {
              kind,
              x: w.x,
              z: w.z,
              angle,
              walk: 0,
              stride: 0,
              atk: -1,
              shout: -1,
              fall: -1,
              hurt: 9,
              alert: false,
            },
            iso,
            C,
            f.time,
            false,
          );
          ctx.globalAlpha = 1;
        },
      });
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
      this.atmosphere.drawLit(ctx, iso, z, this.cam);
    }
    this.drawLight(f);
    this.drawGlow(f, fog);
    this.drawHealth(f, fog);
    // The light has hard steps of its own, so it needs little dither.
    quantize(ctx, W, H, 3, this.cam.x + this.jolt.x, this.cam.y + this.jolt.y);

    // The frame is shifted by the camera's leftover screen pixels, so up to
    // two columns at the right and bottom edge show the void.
    this.out.fillStyle = C.void;
    this.out.fillRect(0, 0, W * SCALE, H * SCALE);
    this.out.drawImage(this.small, -this.sub.x, -this.sub.y, W * SCALE, H * SCALE);
    drawVignette(this.out);
    this.drawLabels(f, fog);
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
    // Once the seal breaks, the lantern burns on in the Creditor's hand.
    const focus = focusOf(f);
    if (focus && focus !== f.sim.bearer) {
      viewers.push({ x: focus.x, z: focus.z, radius: BEARER_SIGHT });
    }
    this.fog.fog.update(f.paused ? 0 : 1 / 60, viewers, f.sim.obstacles);
    return this.fog.fog;
  }

  /**
   * Where a floor point is on the screen element, as a share of its width
   * and height, for browser tests.
   */
  shareOnScreen(x: number, z: number): Pt {
    const b = this.iso(x, z);
    return pt((b.x * SCALE - this.sub.x) / (W * SCALE), (b.y * SCALE - this.sub.y) / (H * SCALE));
  }

  /** Whether the party sees a floor point now. */
  sees(x: number, z: number): boolean {
    return (this.fog?.fog.visible(x, z) ?? 0) > 0.5;
  }

  /** The camera's offset in screen pixels, for browser tests. */
  get camera(): Pt {
    return pt(
      (this.cam.x + this.jolt.x) * SCALE + this.sub.x,
      (this.cam.y + this.jolt.y) * SCALE + this.sub.y,
    );
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
    const bearer = focusOf(f);
    // Flames flicker in their own pixels, not in the reach of their light:
    // a light whose edge moves every frame makes the whole floor crawl.
    const flicker = 0;
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
      } else if (p.kind === 'campfire') {
        lights.push({
          x: p.x,
          z: p.z,
          radius: 2.6 + flicker,
          color: [255, 160, 80],
          strength: 0.75,
        });
      } else if (p.kind === 'brazier' || p.kind === 'torch') {
        // The fires at the exit burn bright, so the way on shows once found.
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
      } else if (p.kind === 'campfire' && fog.known(p.x, p.z)) {
        const b = this.iso(p.x, p.z);
        for (let i = 0; i < 3; i++) {
          const lick = Math.round(Math.sin(f.time * 9 + i * 2.1) * 1.5);
          ctx.fillRect(b.x - 2 + i * 2 + lick, b.y - Math.round((4 + i) * look.zoom), 1, 2 + i);
        }
      } else if (p.kind === 'brazier' && fog.known(p.x, p.z)) {
        const b = this.iso(p.x, p.z);
        const lick = Math.round(Math.sin(f.time * 11 + p.seed * 9) * 1.5);
        ctx.fillRect(b.x - 2, b.y - Math.round(16 * look.zoom), 4, 2);
        ctx.fillRect(b.x - 1 + lick, b.y - Math.round(19 * look.zoom), 2, 3);
      } else if (p.kind === 'torch' && fog.known(p.x, p.z)) {
        const b = this.iso(p.x, p.z);
        const lick = Math.round(Math.sin(f.time * 11 + p.seed * 9));
        ctx.fillRect(b.x - 1, b.y - Math.round(30 * look.zoom), 3, 2);
        ctx.fillRect(b.x + lick, b.y - Math.round(33 * look.zoom), 1, 3);
      }
    }
  }

  // Snares set on the floor: iron jaws, open, a ring of teeth.
  private drawTraps(f: Frame): void {
    const { ctx } = this;
    for (const t of f.sim.traps) {
      const b = this.iso(t.x, t.z);
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x - 4, b.y - 1, 9, 3);
      ctx.fillStyle = C.bone;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(b.x - 4 + i * 2, b.y - 2 + (i % 2), 1, 1);
      }
    }
  }

  // Items on the floor: a small shape for what it is, and a glint for its quality.
  private drawGround(f: Frame, fog: Fog): void {
    const { ctx } = this;
    for (const g of f.ground) {
      if (fog.visible(g.x, g.z) < 0.5) {
        continue;
      }
      const b = this.iso(g.x, g.z);
      const { type } = g.item.base;
      if (type === ItemType.Gold) {
        ctx.fillStyle = C.gold;
        ctx.fillRect(b.x - 1, b.y, 2, 1);
        ctx.fillRect(b.x + 1, b.y - 1, 1, 1);
        continue;
      }
      if (type === ItemType.Potion) {
        // A small flask: red for healing, teal for mana.
        ctx.fillStyle = C.ink;
        ctx.fillRect(b.x - 1, b.y - 4, 3, 4);
        ctx.fillStyle = g.item.base.potion?.health ? C.blood : C.teal;
        ctx.fillRect(b.x - 1, b.y - 2, 3, 2);
        ctx.fillStyle = C.bone;
        ctx.fillRect(b.x, b.y - 5, 1, 1);
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(b.x - 3, b.y, 7, 2);
      ctx.fillStyle = type === ItemType.Weapon || type === ItemType.Accessory ? C.bone : C.cloth;
      if (type === ItemType.Weapon) {
        ctx.fillRect(b.x - 3, b.y - 1, 6, 1);
        ctx.fillRect(b.x - 4, b.y - 2, 1, 3);
      } else if (type === ItemType.Accessory) {
        ctx.fillRect(b.x, b.y - 1, 1, 1);
      } else {
        ctx.fillRect(b.x - 2, b.y - 2, 5, 3);
      }
      const glint = QUALITY_COLOR[g.item.quality];
      if (glint && Math.sin(f.time * 4 + g.item.uid) > 0) {
        ctx.fillStyle = glint;
        ctx.fillRect(b.x + 2, b.y - 3, 1, 1);
      }
    }
  }

  // Item names over the floor, as Diablo 2's labels, in the quality's color.
  private drawLabels(f: Frame, fog: Fog): void {
    const { out } = this;
    out.font = '15px "IM Fell English", Georgia, serif';
    out.textAlign = 'center';
    this.labels.length = 0;
    for (const g of f.ground) {
      if (fog.visible(g.x, g.z) < 0.5) {
        continue;
      }
      const b = this.iso(g.x, g.z);
      const x = b.x * SCALE - this.sub.x;
      let y = (b.y - 4) * SCALE - this.sub.y;
      const name = itemName(g.item);
      const w = out.measureText(name).width + 8;
      // Labels that would overlap stack upward, as Diablo 2's do.
      const overlaps = (ty: number): boolean =>
        this.labels.some(
          (l) => Math.abs(l.x - x) < (l.w + w) / 2 && Math.abs(l.y - ty) < LABEL_HEIGHT,
        );
      while (overlaps(y)) {
        y -= LABEL_HEIGHT;
      }
      this.labels.push({ item: g, x, y, w });
      out.fillStyle = 'rgba(0,0,0,0.65)';
      out.fillRect(x - w / 2, y - 14, w, LABEL_HEIGHT);
      out.fillStyle = LABEL_COLOR[g.item.quality];
      if (g.item.base.type === ItemType.Gold) {
        out.fillStyle = C.gold;
      }
      out.fillText(name, x, y);
    }
    // Each road on names what lies ahead, on its signpost.
    for (const e of f.stage.exits) {
      if (e.ahead === 'down' || !fog.known(e.x - 2.2, e.z - 2.2)) {
        continue;
      }
      const b = this.iso(e.x - 2.2, e.z - 2.2);
      const text = AHEAD_NAME[e.ahead];
      const x = b.x * SCALE - this.sub.x;
      const y = (b.y - 40 * look.zoom) * SCALE - this.sub.y;
      const width = out.measureText(text).width + 8;
      out.fillStyle = 'rgba(0,0,0,0.65)';
      out.fillRect(x - width / 2, y - 14, width, 18);
      out.fillStyle = e.ahead === 'elite' || e.ahead === 'boss' ? '#d47a6a' : '#d6d0c4';
      out.fillText(text, x, y);
    }
    if (f.callout && f.sim.bearer) {
      const r = f.views.rig(f.sim.bearer, f.alpha);
      const b = this.iso(r.x, r.z);
      out.font = '20px "IM Fell English", Georgia, serif';
      out.fillStyle = C.gold;
      out.fillText(
        f.callout,
        b.x * SCALE - this.sub.x,
        (b.y - 46 * look.zoom) * SCALE - this.sub.y,
      );
      out.font = '15px "IM Fell English", Georgia, serif';
    }
    const w = f.wanderer;
    if (w && fog.visible(w.x, w.z) > 0.5) {
      const b = this.iso(w.x, w.z);
      const text = `${w.offer.name}, for hire`;
      const x = b.x * SCALE - this.sub.x;
      const y = (b.y - 52 * look.zoom) * SCALE - this.sub.y;
      const width = out.measureText(text).width + 8;
      out.fillStyle = 'rgba(0,0,0,0.65)';
      out.fillRect(x - width / 2, y - 14, width, 18);
      out.fillStyle = C.gold;
      out.fillText(text, x, y);
    }
    out.textAlign = 'start';
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
      } else if (s.def.id === SUNDERED.id) {
        // Broken armor shows in the stats, not over the head.
        continue;
      } else if (s.def.slow === undefined) {
        // Embers or bubbles rise off the body.
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.9 + i / 3) % 1;
          const px = b.x + Math.round(Math.sin(i * 2.3 + time) * 4);
          const py = Math.round(b.y - (8 + t * (barHeight(u) - 6)) * look.zoom);
          ctx.fillRect(px, py, 1, 1);
        }
      } else {
        // Frost settles at the feet, or the snare's jaws close on them.
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(b.x - 5 + i * 3, b.y + (i % 2), 1, 1);
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
      'WASD or click: move.  1–4: mercs.  Z X C F: shouts.  I: pack.  M: map.  Q: drink.  R: restart.',
      16,
      26,
    );
    out.textAlign = 'right';
    out.fillText(
      `${layerOf(f.stage.index).name} · ${place(f.stage)} · Slain: ${f.slain}`,
      W * SCALE - 16,
      26,
    );
    out.textAlign = 'start';
    out.fillStyle = '#8a8274';
    out.fillText(hint(f), 16, 52);
    if (f.notice) {
      out.fillStyle = C.gold;
      out.fillText(f.notice, 16, 76);
    }
    if (f.boss?.alive && (f.stage.arena?.closed || f.stage.tomb)) {
      // The boss's name and health across the top, as Diablo 2 shows them.
      const w = 360;
      const x = (W * SCALE - w) / 2;
      out.textAlign = 'center';
      out.fillStyle = '#d6d0c4';
      out.fillText(f.boss.name, (W * SCALE) / 2, 92);
      out.textAlign = 'start';
      out.fillStyle = 'rgba(0,0,0,0.7)';
      out.fillRect(x, 100, w, 8);
      out.fillStyle = C.blood;
      out.fillRect(x + 1, 101, Math.round(((w - 2) * f.boss.hp) / f.boss.derived.maxHp), 6);
    }
    if (f.over) {
      const [title, line] = ENDING[f.ending ?? 'fallen'];
      out.fillStyle = 'rgba(0,0,0,0.6)';
      out.fillRect(0, 0, W * SCALE, H * SCALE);
      out.fillStyle = f.ending === 'sealed' ? C.gold : C.blood;
      out.font = '44px "IM Fell English SC", Georgia, serif';
      out.textAlign = 'center';
      out.fillText(title, (W * SCALE) / 2, (H * SCALE) / 2);
      out.font = '18px "IM Fell English", Georgia, serif';
      out.fillStyle = '#c8c2b6';
      out.fillText(line, (W * SCALE) / 2, (H * SCALE) / 2 + 36);
      out.font = '16px ui-monospace, monospace';
      out.fillStyle = '#9a9a9a';
      out.fillText('Press R to draw another lot.', (W * SCALE) / 2, (H * SCALE) / 2 + 70);
      out.textAlign = 'start';
    }
  }
}

// Where the party is, for the HUD.
function place(stage: Stage): string {
  if (stage.kind === 'waystation') {
    return 'Waystation';
  }
  if (stage.kind === 'tomb') {
    return 'The Tomb';
  }
  const area = `Area ${areaOf(stage.index)}`;
  if (stage.kind === 'elite') {
    return `${area}, Elite`;
  }
  if (stage.kind === 'camp') {
    return `${area}, Camp`;
  }
  return area;
}

// What the player is to do in this area, under the controls.
function hint(f: Frame): string {
  if (f.stage.tomb) {
    return f.boss
      ? 'The Creditor wakes in the bearer’s body. The mercs fight on alone. 1–4 to look at them.'
      : 'The tomb at the bottom of the Hollow. Bring the Writ to it.';
  }
  if (f.stage.station) {
    return 'The Guild’s Waystation. Pay your mercs and use the vault at the post, then take a road east.';
  }
  if (f.boss) {
    if (f.boss.alive) {
      return f.stage.arena?.closed
        ? `${f.boss.name} bars the way down. The gate is shut.`
        : 'Something waits in the walled ring, before the way down.';
    }
    return 'The way down is open, to the east.';
  }
  if (f.stage.rest) {
    return 'A Camp. Walk to the fire to rest, then take a road on. M for the map.';
  }
  if (f.stage.exits.length > 1) {
    return 'The road forks to the east. Each signpost says what lies ahead. M for the map.';
  }
  return 'Follow the road east, to the next area. M for the map.';
}

// Whether a floor point's screen spot is near enough the frame to draw what stands there.
function onScreen(b: Pt): boolean {
  return b.x > -64 && b.x < W + 64 && b.y > -24 && b.y < H + 120;
}

// How much higher a boss's health bar floats than its kind's.
const BOSS_BAR = 1.7;

function barHeight(u: Unit): number {
  const elite = u.rank === Rank.Normal ? 1 : 1.25;
  if (u.kind === 'bearer') {
    return 36;
  }
  if (u.kind === 'crawler') {
    return 16 * elite;
  }
  if (u.kind === 'broodMother') {
    return 34;
  }
  // The other bosses are drawn as their kind, larger.
  if (u.rank === Rank.Boss) {
    return 44 * BOSS_BAR;
  }
  if (u.kind === 'mite') {
    return 10 * elite;
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
  if (p.kind === 'tree') {
    // A dead tree of the burned Marches: a bare, leaning trunk and a few
    // crooked limbs.
    const lean = (p.seed - 0.5) * 8;
    const top = pt(base.x + lean, base.y - 42 - p.seed * 16);
    for (let i = 0; i < 4; i++) {
      const t = 0.4 + i * 0.15;
      const from = pt(base.x + (top.x - base.x) * t, base.y + (top.y - base.y) * t);
      const side = (i + Math.round(p.seed * 3)) % 2 ? 1 : -1;
      const to = pt(from.x + side * (9 + ((p.seed * 13 + i * 5) % 7)), from.y - 9 - i * 2);
      fillPoly(ctx, quad(from, to, 1.4, 0.5), C.wood);
    }
    fillPoly(ctx, quad(base, top, 4, 1), C.wood);
    fillPoly(ctx, quad(base, pt(base.x - 7, base.y + 2), 1.5, 0.5), C.wood);
    fillPoly(ctx, quad(base, pt(base.x + 6, base.y + 3), 1.5, 0.5), C.wood);
  } else if (p.kind === 'torch') {
    // A torch on a post, lighting the road on.
    fillPoly(
      ctx,
      [
        pt(base.x - 1, base.y),
        pt(base.x + 1, base.y),
        pt(base.x + 1, base.y - 28),
        pt(base.x - 1, base.y - 28),
      ],
      C.wood,
    );
  } else if (p.kind === 'signpost') {
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
  } else if (p.kind === 'post') {
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
  } else if (p.kind === 'strongbox') {
    // The vault: the Guild's iron-bound strongbox.
    block(ctx, base, 0.38, 11, 0.5, C.stoneA);
    ctx.fillStyle = C.ink;
    ctx.fillRect(base.x - 12, base.y - 7, 24, 1);
    ctx.fillStyle = C.gold;
    ctx.fillRect(base.x - 1, base.y - 6, 3, 3);
  } else if (p.kind === 'sarcophagus') {
    // The Creditor's sarcophagus: long, low and black, its lid sealed with
    // the Church's blood.
    block(ctx, base, 0.9, 12, p.seed, C.monster);
    fillPoly(
      ctx,
      [
        pt(base.x - 26, base.y - 12),
        pt(base.x, base.y - 25),
        pt(base.x + 26, base.y - 12),
        pt(base.x, base.y + 1),
      ],
      C.stoneB,
    );
    fillPoly(ctx, blob(pt(base.x, base.y - 12), 6, 3, 9, p.seed), C.blood, null);
  } else if (p.kind === 'gate') {
    // Stakes of the arena's gate: a stump while open, a sharpened post once shut.
    if (p.r === undefined) {
      fillPoly(ctx, quad(pt(base.x, base.y), pt(base.x, base.y - 5), 2, 1.5), C.wood);
    } else {
      block(ctx, base, 0.35, 34, p.seed, C.wood);
      fillPoly(
        ctx,
        [pt(base.x - 5, base.y - 34), pt(base.x + 5, base.y - 34), pt(base.x, base.y - 41)],
        C.wood,
      );
    }
  } else if (p.kind === 'pillar') {
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
  } else if (p.kind === 'campfire') {
    // Crossed logs in a ring of stones. The flames are drawn after the light.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.fillStyle = C.stoneA;
      ctx.fillRect(
        Math.round(base.x + Math.cos(a) * 8),
        Math.round(base.y + Math.sin(a) * 4),
        2,
        2,
      );
    }
    fillPoly(ctx, quad(pt(base.x - 6, base.y + 1), pt(base.x + 6, base.y - 2), 1.2, 1.2), C.wood);
    fillPoly(ctx, quad(pt(base.x - 5, base.y - 2), pt(base.x + 5, base.y + 1), 1.2, 1.2), C.wood);
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

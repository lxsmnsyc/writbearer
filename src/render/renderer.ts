import type { Stage } from '../gen/stage';
import type { GroundItem } from '../game/inventory';
import type Sim from '../sim/sim';
import type Unit from '../sim/unit';
import { type Pt, pt } from './draw';
import Atmosphere, { drawVignette } from './atmosphere';
import { type Effects, drawPiece } from './effects';
import { type FloorImage, buildFloor } from './floor';
import { Fogs } from './fog';
import { Lighting } from './light';
import { C, quantize } from './palette';
import { look } from './rig';
import type { Views } from './view';
import drawHealth from './draw/bars';
import drawEmbers from './draw/embers';
import { drawExits, drawSigns } from './draw/exits';
import drawGlow from './draw/glow';
import { drawHazards } from './draw/hazards';
import drawHud from './draw/hud';
import { type ItemLabel, LABEL_HEIGHT, drawItemLabels, drawItems } from './draw/items';
import { drawCallout, drawEliteLabels, drawFigureLabels } from './draw/labels';
import { drawLight, viewersOf } from './draw/light';
import { drawRings, drawSpots, drawTraps, drawWarnings, drawZones } from './draw/marks';
import { drawCollapse, drawRites, drawSigil } from './draw/objectives';
import drawQuarry from './draw/quarry';
import { H, SCALE, type Scene, W, focusOf, th, tw } from './draw/scene';
import { drawStanding } from './draw/standing';

// Each drawing feature lives in its own module under `./draw/`; the
// renderer holds the camera, the caches and the order they are drawn in.
export { H, SCALE, W } from './draw/scene';
export { EXIT_PLATE } from './draw/exits';
export { LABEL_COLOR } from './draw/items';

export interface Frame {
  sim: Sim;
  // The area the party is in
  stage: Stage;
  // Every area in the world: the one the party is in, the one joined ahead,
  // and the one behind as it fades away, each with how solid it is, 0 to 1
  areas: { stage: Stage; alpha: number }[];
  views: Views;
  effects: Effects;
  // How far between the last tick and the next, 0 to 1
  alpha: number;
  time: number;
  slain: number;
  // Items lying on the floor
  ground: GroundItem[];
  // Someone standing in the area who is not in a fight: a merc for hire
  // by its fire, or whoever waits at an Event, with a label over its head
  figures: { kind: string; x: number; z: number; label: string | null; fallen: boolean }[];
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
  // Where the party is: the layer, or an endless phase
  region: string;
  // The exit under the mouse, and the one the bearer was sent to, if any
  hoverExit: number | null;
  leaving: number | null;
  // Whether the area's objective still holds every exit shut
  exitsShut: boolean;
  // Whether to show the level director's key points, for tuning it
  spots?: boolean;
  // Whether the Darkness mutator halves the party's light
  dark: boolean;
  // The run's seed, shown when it ends so it can be shared
  seed: string;
  // How the final fight ended: the Creditor sealed again, or risen
  ending: 'sealed' | 'risen' | null;
}

export default class Renderer {
  private readonly out: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly small: HTMLCanvasElement;
  // The camera in frame pixels: `glide` is where it is, easing after the
  // bearer, and `cam` that place in whole pixels, which the ground is drawn
  // at. Moving figures are drawn against `glide`, so the one the camera
  // follows holds still. `sub` is a share of a pixel the frame could be
  // shifted by when it is scaled up. It stays 0: figures cannot follow it.
  private readonly cam = { x: 0, y: 0 };
  private readonly sub = { x: 0, y: 0 };
  private readonly glide = { x: 0, y: 0 };
  private readonly jolt = { x: 0, y: 0 };
  private camReady = false;
  // Where each item's floor label was drawn this frame, in screen pixels
  private readonly labels: ItemLabel[] = [];
  private readonly lighting = new Lighting(W, H);
  private readonly atmosphere = new Atmosphere(W, H);
  private readonly floors = new Map<Stage, { zoom: number; image: FloorImage }>();
  private readonly fog = new Fogs();
  // A Hunt's marked monsters the party has seen, which arrows point to
  private readonly sighted = new WeakSet<Unit>();
  private readonly scratch: CanvasRenderingContext2D;
  // What the draw modules draw with
  private readonly scene: Scene;

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
    this.scene = {
      ctx: this.ctx,
      out: this.out,
      scratch: this.scratch,
      iso: this.iso,
      body: this.body,
      sub: this.sub,
    };
  }

  /** Where a floor point is on the small canvas, for the ground and what stands still on it. */
  readonly iso = (x: number, z: number): Pt =>
    pt(
      Math.round((x - z) * (tw() / 2) - this.cam.x - this.jolt.x),
      Math.round((x + z) * (th() / 2) - this.cam.y - this.jolt.y),
    );

  /**
   * Where a moving figure stands on the small canvas: snapped against the
   * camera's exact place, not its whole pixel. A figure the camera follows
   * then holds still on the screen, instead of stepping back and forth a
   * pixel as the two round at different moments.
   */
  readonly body = (x: number, z: number): Pt =>
    pt(
      Math.round((x - z) * (tw() / 2) - this.glide.x - this.jolt.x),
      Math.round((x + z) * (th() / 2) - this.glide.y - this.jolt.y),
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
    const { ctx, iso, scene } = this;
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
      // Whole pixels of the small canvas only: scrolling by a share of a
      // pixel moves the ground smoothly but not the figures on it, which
      // shook against it.
      this.cam.x = Math.round(this.glide.x);
      this.cam.y = Math.round(this.glide.y);
      this.sub.x = 0;
      this.sub.y = 0;
    }
    this.jolt.x = f.shake > 0 ? Math.round((Math.random() * 2 - 1) * f.shake) : 0;
    this.jolt.y = f.shake > 0 ? Math.round((Math.random() * 2 - 1) * f.shake) : 0;

    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    this.drawStoneFloor(f);
    for (const s of f.areas.flatMap((a) => a.stage.sigils)) {
      drawSigil(scene, s);
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
    drawItems(scene, f, fog);
    drawExits(scene, f, fog);
    drawHazards(scene, f, fog);
    f.effects.drawRings(ctx, iso);
    drawZones(scene, f);
    drawTraps(scene, f);
    drawWarnings(scene, f);
    drawRings(scene, f);
    drawStanding(scene, f, fog, bearer);
    f.effects.drawAir(ctx, iso, (px, pz) => fog.visible(px, pz) > 0.5);

    if (bearer) {
      const b = f.views.rig(bearer, f.alpha);
      this.atmosphere.update(f.paused ? 0 : 1 / 60, b.x, b.z);
      this.atmosphere.drawLit(ctx, iso, z, this.cam);
    }
    drawLight(scene, f, this.lighting);
    // A Collapse's fallen floor is black whatever the light, and hides what
    // stood on it.
    drawCollapse(scene, f);
    drawEmbers(scene, f, fog);
    // A Ritual's next sigil shines through the dark, so it can be found.
    drawRites(scene, f);
    if (f.spots === true) {
      drawSpots(scene, f);
    }
    drawGlow(scene, f, fog);
    drawHealth(scene, f, fog);
    // Snapped to the palette with no dither. A dither pattern fixed to the
    // floor shimmers over anything that moves across it, and the light has
    // hard steps of its own.
    quantize(ctx, W, H, 0);

    // The frame is shifted by the camera's leftover screen pixels, so up to
    // two columns at the right and bottom edge show the void.
    this.out.fillStyle = C.void;
    this.out.fillRect(0, 0, W * SCALE, H * SCALE);
    this.out.drawImage(this.small, -this.sub.x, -this.sub.y, W * SCALE, H * SCALE);
    drawVignette(this.out);
    this.drawLabels(f, fog);
    drawQuarry(scene, f, fog, this.sighted);
    drawHud(this.out, f);
  }

  // What the party sees this frame. Solid props block sight; bodies do not.
  private updateFog(f: Frame): Fogs {
    this.fog.sync(f.areas.map((a) => a.stage));
    this.fog.update(f.paused ? 0 : 1 / 60, viewersOf(f), f.sim.obstacles);
    return this.fog;
  }

  /**
   * Where a floor point is on the screen element, as a share of its width
   * and height, for browser tests.
   */
  shareOnScreen(x: number, z: number): Pt {
    const b = this.iso(x, z);
    return pt((b.x * SCALE - this.sub.x) / (W * SCALE), (b.y * SCALE - this.sub.y) / (H * SCALE));
  }

  /** Whether the party has seen a floor point. */
  known(x: number, z: number): boolean {
    return this.fog.known(x, z);
  }

  /** Whether the party sees a floor point now. */
  sees(x: number, z: number): boolean {
    return this.fog.visible(x, z) > 0.5;
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

  // The worn stone floor, drawn once per stage and zoom, then copied.
  private drawStoneFloor(f: Frame): void {
    for (const stage of this.floors.keys()) {
      if (!f.areas.some((a) => a.stage === stage)) {
        this.floors.delete(stage);
      }
    }
    for (const { stage, alpha } of f.areas) {
      let floor = this.floors.get(stage);
      if (floor?.zoom !== look.zoom) {
        floor = { zoom: look.zoom, image: buildFloor(stage, look.zoom, 1234) };
        this.floors.set(stage, floor);
      }
      const { image } = floor;
      const origin = this.iso(stage.x0 ?? 0, stage.z0 ?? 0);
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image.canvas, origin.x - image.ox, origin.y - image.oy);
      this.ctx.globalAlpha = 1;
    }
  }

  // Names over the floor, on the screen: items, signposts, the bearer's
  // shout, who waits in the area and elites, in that order.
  private drawLabels(f: Frame, fog: Fogs): void {
    const { out, scene } = this;
    out.font = '600 13px Inter, system-ui, sans-serif';
    out.textAlign = 'center';
    this.labels.length = 0;
    drawItemLabels(scene, f, fog, this.labels);
    drawSigns(scene, f, fog);
    drawCallout(scene, f);
    drawFigureLabels(scene, f, fog);
    drawEliteLabels(scene, f, fog);
    out.textAlign = 'start';
  }
}

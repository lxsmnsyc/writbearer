import { EventPriority } from '../core/event-emitter';
import { RunStreams, Stream, randomSeed } from '../core/seed';
import { SimEvents } from '../sim/events';
import Sim, { TICK } from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';
import { Effects } from '../render/effects';
import Renderer from '../render/renderer';
import { Views } from '../render/view';
import { type Stage, populate, sealingSite, spawnWave } from './stage';

// Never simulate more than this much time in one frame, so a stalled tab
// does not fast-forward the fight.
const MAX_FRAME = 0.25;
const WAVE_EVERY = 16;
const MAX_MONSTERS = 9;

export interface GameHooks {
  // Called when the player selects a merc, or clears the selection with null.
  onSelect?: (unit: Unit | null) => void;
}

/**
 * One playable stage: the simulation at a fixed 20 ticks per second, drawn
 * every frame between ticks.
 */
export default class Game {
  private readonly renderer: Renderer;
  private readonly keys = new Set<string>();
  private sim!: Sim;
  private stage!: Stage;
  private views!: Views;
  private effects!: Effects;
  private bearer!: Unit;
  private streams!: RunStreams;
  private time = 0;
  private acc = 0;
  private slain = 0;
  private over = false;
  private waveTimer = 0;
  private frameId = 0;
  private last = 0;
  private selected: Unit | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: GameHooks = {},
  ) {
    this.renderer = new Renderer(canvas);
    this.reset();
  }

  /** The game pauses while a merc's orders are open. */
  get paused(): boolean {
    return this.selected !== null;
  }

  /** The mercs, alive or dead, in the order they joined. */
  mercs(): Unit[] {
    return [...this.sim.units].filter((u) => u.side === Side.Party && u !== this.bearer);
  }

  select(unit: Unit | null): void {
    this.selected = unit;
    // Held keys would walk the bearer the moment the game resumes.
    this.keys.clear();
    this.hooks.onSelect?.(unit);
  }

  // The merc drawn under a point on the screen, if any.
  private pickMerc(clientX: number, clientY: number): Unit | null {
    const s = this.renderer.toSmall(clientX, clientY);
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const u of this.mercs()) {
      if (!u.alive) {
        continue;
      }
      const r = this.views.rig(u, 1);
      const b = this.renderer.iso(r.x, r.z);
      const inside = Math.abs(s.x - b.x) <= 8 && s.y >= b.y - 36 && s.y <= b.y + 4;
      const d = Math.hypot(s.x - b.x, s.y - (b.y - 16));
      if (inside && d < bestD) {
        best = u;
        bestD = d;
      }
    }
    return best;
  }

  reset(): void {
    this.streams = new RunStreams(randomSeed());
    this.sim = new Sim(this.streams.get(1, Stream.Combat));
    this.stage = sealingSite();
    this.views = new Views();
    this.effects = new Effects(this.sim, this.views);
    this.bearer = populate(this.sim, this.stage);
    const rng = this.streams.get(1, Stream.Layout);
    for (let i = 0; i < 6; i++) {
      this.effects.stain(rng.range(3, 23), rng.range(3, 23), rng.range(0.4, 0.9), '#560b0b');
    }
    this.sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      if (event.source.side === Side.Monster) {
        this.slain++;
      }
      if (event.source === this.bearer) {
        this.over = true;
      }
    });
    this.slain = 0;
    this.over = false;
    this.select(null);
    this.acc = 0;
    this.waveTimer = 14;
  }

  start(): void {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.last = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    cancelAnimationFrame(this.frameId);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      this.select(null);
      return;
    }
    // Number keys open a merc's orders.
    const index = Number(key) - 1;
    const merc = Number.isInteger(index) && index >= 0 ? this.mercs().at(index) : undefined;
    if (merc?.alive) {
      this.select(merc);
      return;
    }
    if (this.paused) {
      return;
    }
    this.keys.add(key);
    if (key === 'r') {
      this.reset();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (this.over) {
      return;
    }
    // Clicking a merc opens its orders. Clicking anywhere else closes them,
    // or walks the bearer there.
    const merc = this.pickMerc(e.clientX, e.clientY);
    if (merc) {
      this.select(merc);
      return;
    }
    if (this.paused) {
      this.select(null);
      return;
    }
    const spot = this.renderer.unproject(e.clientX, e.clientY);
    const max = this.stage.size - 0.5;
    this.bearer.order = {
      x: Math.min(max, Math.max(0.5, spot.x)),
      z: Math.min(max, Math.max(0.5, spot.z)),
    };
  };

  // WASD moves along the screen: right is +x -z, down is +x +z.
  private steer(): void {
    let mx = 0;
    let my = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) {
      my -= 1;
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      my += 1;
    }
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      mx -= 1;
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      mx += 1;
    }
    if (mx === 0 && my === 0) {
      return;
    }
    const wx = mx + my;
    const wz = my - mx;
    const l = Math.hypot(wx, wz);
    this.bearer.order = { x: this.bearer.x + (wx / l) * 0.6, z: this.bearer.z + (wz / l) * 0.6 };
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(MAX_FRAME, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) {
      // Everything stops, including blood in the air.
      this.render(0);
      this.frameId = requestAnimationFrame(this.frame);
      return;
    }
    this.time += dt;
    if (!this.over) {
      this.acc += dt;
      while (this.acc >= TICK) {
        this.steer();
        this.sim.tick(TICK);
        this.views.afterTick(this.sim);
        this.waves();
        this.acc -= TICK;
      }
    }
    this.views.frame(this.sim, dt);
    this.effects.update(dt);
    this.render(this.over ? 1 : this.acc / TICK);
    this.frameId = requestAnimationFrame(this.frame);
  };

  private render(alpha: number): void {
    this.renderer.render({
      sim: this.sim,
      stage: this.stage,
      views: this.views,
      effects: this.effects,
      alpha,
      time: this.time,
      slain: this.slain,
      over: this.over,
      paused: this.paused,
      selected: this.selected,
    });
    // Exposed for browser tests, which cannot see inside the canvas.
    this.canvas.dataset.bearer = `${this.bearer.x.toFixed(2)},${this.bearer.z.toFixed(2)}`;
  }

  private waves(): void {
    this.waveTimer -= TICK;
    if (this.waveTimer <= 0 && this.sim.living(Side.Monster).length < MAX_MONSTERS) {
      spawnWave(this.sim, this.streams.get(1, Stream.Events), this.bearer, this.stage.size);
      this.waveTimer = WAVE_EVERY;
    }
  }
}

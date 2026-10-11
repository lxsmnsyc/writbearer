import { EventPriority } from '../core/event-emitter';
import { RunStreams, Stream, randomSeed } from '../core/seed';
import { SimEvents } from '../sim/events';
import { look } from '../render/rig';
import Sim, { TICK } from '../sim/sim';
import { DamageFlags, DamagePriority, Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { Effects } from '../render/effects';
import Renderer from '../render/renderer';
import { Views } from '../render/view';
import { type Stage, generateStage } from '../gen/stage';
import { type EquipSlot, type Item, isPotion } from '../sim/item';
import { BASE_BY_ID, STARTER_PACK } from '../content/items';
import { potionStack, rollDrops, rollGold, rollItem, rollPotion } from '../gen/loot';
import { gainXp, killXp } from '../sim/progress';
import {
  type GroundItem,
  Pack,
  beltToPack,
  equipFromPack,
  packToBelt,
  unequipToPack,
} from './inventory';
import { carryParty, enterStage, spawnParty } from './stage';

// Never simulate more than this much time in one frame, so a stalled tab
// does not fast-forward the fight.
const MAX_FRAME = 0.25;
// The bearer takes the stair down once this close to it.
const EXIT_REACH = 1.2;
// The bearer picks up an item, or opens a chest, from this close.
const PICK_REACH = 0.8;
const CHEST_REACH = 1.3;
// A chest holds this many pieces of equipment, rolled as an elite's drop.
const CHEST_ITEMS = 3;
// How near a click must land to an item, in frame pixels, to pick it up.
const PICK_PIXELS = 8;
// Impact: hits at least this heavy freeze the world briefly and shake it.
const HEAVY_HIT = 14;
const HIT_STOP = 0.06;
const MAX_SHAKE = 3;

export interface GameHooks {
  // Called when the player selects a merc, or clears the selection with null.
  onSelect?: (unit: Unit | null) => void;
  // Called when the inventory opens or closes.
  onInventory?: (open: boolean) => void;
  // Called whenever the pack, anyone's gear, levels or skills change.
  onChange?: () => void;
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
  // Which stage of the run the party is on, from 0
  private stageIndex = 0;
  private frameId = 0;
  private last = 0;
  private selected: Unit | null = null;
  private inventory = false;
  // What the bearer carries, and what lies on the floor
  pack = new Pack();
  private ground: GroundItem[] = [];
  // The item the bearer is walking over to pick up
  private fetching: GroundItem | null = null;
  // Impact: a short freeze on heavy hits, and screen shake in pixels.
  private hitStop = 0;
  private shake = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: GameHooks = {},
  ) {
    this.renderer = new Renderer(canvas);
    this.reset();
  }

  /** The game pauses while a merc's orders are open. */
  get paused(): boolean {
    return this.selected !== null || this.inventory;
  }

  /** Opens or closes the inventory. The game pauses while it is open. */
  openInventory(open: boolean): void {
    this.inventory = open;
    this.keys.clear();
    if (open) {
      this.select(null);
    }
    this.hooks.onInventory?.(open);
  }

  get inventoryOpen(): boolean {
    return this.inventory;
  }

  /** Hands an item from the pack to a merc. Returns why it failed, or null. */
  equip(merc: Unit, uid: number): string | null {
    const item = this.pack.items.find((i) => i.uid === uid);
    // Potions go on the belt, everything else is worn.
    const error =
      item && isPotion(item)
        ? packToBelt(this.sim, this.bearer, this.pack, merc, uid)
        : equipFromPack(this.sim, this.bearer, this.pack, merc, uid);
    this.itemsChanged();
    return error;
  }

  /** Takes an item off a merc into the pack. Returns why it failed, or null. */
  unequip(merc: Unit, slot: EquipSlot): string | null {
    const error = unequipToPack(this.sim, this.bearer, this.pack, merc, slot);
    this.itemsChanged();
    return error;
  }

  /** Takes a belt slot's potions back into the pack. Returns why it failed, or null. */
  unbelt(merc: Unit, slot: number): string | null {
    const error = beltToPack(this.sim, this.bearer, this.pack, merc, slot);
    this.itemsChanged();
    return error;
  }

  /** The bearer drinks a healing potion from the pack. */
  drinkHealing(): void {
    const potion = this.pack.healingPotion();
    if (potion && this.bearer.drink(potion)) {
      this.pack.tidy();
      this.itemsChanged();
    }
  }

  /** Drops an item from the pack at the bearer's feet. */
  drop(uid: number): void {
    const item = this.pack.take(uid);
    if (item) {
      this.ground.push({ item, x: this.bearer.x + 0.3, z: this.bearer.z + 0.3 });
      this.itemsChanged();
    }
  }

  private itemsChanged(): void {
    this.bearer.burden = this.pack.speed;
    this.hooks.onChange?.();
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
      const z = look.zoom;
      const inside = Math.abs(s.x - b.x) <= 8 * z && s.y >= b.y - 36 * z && s.y <= b.y + 4 * z;
      const d = Math.hypot(s.x - b.x, s.y - (b.y - 16 * z));
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
    this.stageIndex = 0;
    this.stage = this.buildStage();
    this.views = new Views();
    this.effects = new Effects(this.sim, this.views);
    this.bearer = spawnParty(this.sim, this.stage);
    this.enter();
    this.sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.value < HEAVY_HIT || event.flags & DamageFlags.DoT) {
        return;
      }
      this.hitStop = Math.max(this.hitStop, HIT_STOP);
      this.shake = Math.max(this.shake, Math.min(MAX_SHAKE, event.value / 12));
    });
    this.sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      if (event.source.side === Side.Monster) {
        this.slain++;
        this.shareXp(event.source);
        this.scatter(
          rollDrops(this.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
          event.source,
        );
      }
      if (event.source === this.bearer) {
        this.over = true;
      }
    });
    this.slain = 0;
    this.over = false;
    this.pack = new Pack();
    for (const [id, count] of STARTER_PACK) {
      const base = BASE_BY_ID.get(id);
      if (base) {
        this.pack.add(potionStack(base, count));
      }
    }
    this.ground = [];
    this.fetching = null;
    this.inventory = false;
    this.select(null);
    this.acc = 0;
    this.hooks.onInventory?.(false);
    this.itemsChanged();
  }

  // A kill's experience, shared evenly by the living mercs.
  private shareXp(monster: Unit): void {
    const mercs = this.mercs().filter((m) => m.alive);
    const each = Math.round(killXp(monster) / Math.max(1, mercs.length));
    for (const m of mercs) {
      if (gainXp(m, each) > 0) {
        this.effects.levelUp(m);
        this.hooks.onChange?.();
      }
    }
  }

  /** Tells the interface the party changed, after a skill or stat was spent. */
  changed(): void {
    this.hooks.onChange?.();
  }

  // Throws items onto the floor around a spot, as a monster falls or a chest opens.
  private scatter(items: Item[], at: { x: number; z: number }): void {
    const rng = this.streams.get(1, Stream.Loot);
    for (const item of items) {
      const a = rng.random() * Math.PI * 2;
      const r = rng.range(0.3, 0.9);
      this.ground.push({ item, x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r });
    }
  }

  // Picks up what the bearer reached, and opens chests it stands at.
  private loot(): void {
    const b = this.bearer;
    if (!b.alive) {
      return;
    }
    // Gold is picked up by walking over it. Equipment needs a click.
    // A copy, since picking up removes from the list.
    for (const g of this.ground.slice()) {
      const near = Math.hypot(g.x - b.x, g.z - b.z) <= PICK_REACH;
      if (near && (g === this.fetching || g.item.base.id === 'gold')) {
        this.pickUp(g);
      }
    }
    for (const p of this.stage.props) {
      if (p.kind === 'chest' && !p.open && b.distanceTo(p) <= CHEST_REACH) {
        p.open = true;
        const rng = this.streams.get(1, Stream.Loot);
        const level = 4 + this.stageIndex;
        const items = Array.from({ length: CHEST_ITEMS }, () => rollItem(rng, level, Rank.Elite));
        this.scatter([...items, rollGold(rng, level), rollPotion(rng, level, 2)], p);
      }
    }
  }

  private pickUp(g: GroundItem): void {
    if (this.fetching === g) {
      this.fetching = null;
    }
    if (this.pack.add(g.item)) {
      this.ground.splice(this.ground.indexOf(g), 1);
      this.itemsChanged();
    }
  }

  // The item drawn under a point on the screen, if any.
  private pickItem(clientX: number, clientY: number): GroundItem | null {
    const s = this.renderer.toSmall(clientX, clientY);
    let best: GroundItem | null = null;
    let bestD = PICK_PIXELS;
    for (const g of this.ground) {
      const p = this.renderer.iso(g.x, g.z);
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  private buildStage(): Stage {
    return generateStage(this.streams.area(1, Stream.Layout, this.stageIndex), this.stageIndex);
  }

  // Lays out the current stage around the party.
  private enter(): void {
    enterStage(this.sim, this.stage);
    for (const s of this.stage.stains) {
      this.effects.stain(s.x, s.z, s.r, '#560b0b');
    }
  }

  // The bearer took the stair down: on to the next stage, party and all.
  private descend(): void {
    this.stageIndex++;
    this.stage = this.buildStage();
    carryParty(this.sim, this.stage);
    this.effects.clear();
    // What was left on the old stage's floor is lost.
    this.ground = [];
    this.fetching = null;
    this.views.snap(this.sim);
    this.renderer.snapCamera();
    this.enter();
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
      this.openInventory(false);
      return;
    }
    if (key === 'q' && !this.over && !this.paused) {
      this.drinkHealing();
      return;
    }
    if (key === 'i' && !this.over) {
      this.openInventory(!this.inventory);
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
    if (this.inventory) {
      return;
    }
    const merc = this.pickMerc(e.clientX, e.clientY);
    if (merc) {
      this.select(merc);
      return;
    }
    if (this.paused) {
      this.select(null);
      return;
    }
    // Clicking an item walks the bearer over to pick it up.
    const item = this.pickItem(e.clientX, e.clientY);
    if (item) {
      this.fetching = item;
      this.bearer.order = { x: item.x, z: item.z };
      return;
    }
    this.fetching = null;
    const spot = this.renderer.unproject(e.clientX, e.clientY);
    this.bearer.order = {
      x: Math.min(this.stage.width - 0.5, Math.max(0.5, spot.x)),
      z: Math.min(this.stage.depth - 0.5, Math.max(0.5, spot.z)),
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
    this.fetching = null;
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
    this.shake *= 0.82;
    if (this.hitStop > 0) {
      // Hit-stop: the world holds still for a moment on a heavy blow.
      this.hitStop -= dt;
      this.render(this.acc / TICK);
      this.frameId = requestAnimationFrame(this.frame);
      return;
    }
    if (!this.over) {
      this.acc += dt;
      while (this.acc >= TICK) {
        this.steer();
        this.sim.tick(TICK);
        this.views.afterTick(this.sim);
        this.loot();
        this.acc -= TICK;
        if (this.bearer.alive && this.bearer.distanceTo(this.stage.exit) <= EXIT_REACH) {
          this.descend();
          this.acc = 0;
        }
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
      depth: this.stageIndex + 1,
      ground: this.ground,
      over: this.over,
      paused: this.paused,
      selected: this.selected,
      shake: this.shake,
    });
    // Exposed for browser tests, which cannot see inside the canvas.
    this.canvas.dataset.bearer = `${this.bearer.x.toFixed(2)},${this.bearer.z.toFixed(2)}`;
  }
}

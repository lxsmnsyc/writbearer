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
import {
  type Ahead,
  type Stage,
  generateStage,
  generateTomb,
  generateWaystation,
  monsterLevel,
} from '../gen/stage';
import { reveal } from '../content/creditor';
import { type LayerMap, type MapNode, generateLayerMap } from '../gen/graph';
import { AREAS_PER_LAYER, LAYERS, layerIndexOf } from '../gen/layers';
import { type EquipSlot, type Item, isCard, isPotion, refinable } from '../sim/item';
import { BASE_BY_ID, STARTER_PACK } from '../content/items';
import {
  itemName,
  potionStack,
  rollCards,
  rollDrops,
  rollGold,
  rollItem,
  rollPotion,
} from '../gen/loot';
import { gainXp, killXp } from '../sim/progress';
import {
  type GroundItem,
  Pack,
  Vault,
  beltToPack,
  equipFromPack,
  packToBelt,
  socketCard,
  storeInVault,
  takeFromVault,
  unequipToPack,
} from './inventory';
import { type Due, Payroll, desert } from './wages';
import {
  addSocket,
  buy,
  cannotAddSocket,
  cannotRefine,
  craft,
  raise,
  refine,
  salvageItem,
  sell,
} from './town';
import { gather, materialsFrom } from '../content/materials';
import type { Recipe } from '../content/recipes';
import type RNG from '../core/rng';
import { RESTED, shiftMorale } from '../sim/morale';
import { ALL_SHOUTS, SHOUTS, Shout, cooldownLeft, cry } from '../sim/shout';
import { type Offer, rollOffer, rollStartingOffers, wageFor } from '../content/recruits';
import { spawnMerc } from '../content/roster';
import { START_LEVEL, carryParty, enterStage, shutArena, spawnParty } from './stage';

// Never simulate more than this much time in one frame, so a stalled tab
// does not fast-forward the fight.
const MAX_FRAME = 0.25;
// The bearer leaves by the exit once this close to it.
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
  // Called with the offers to pick from at the start of a run, then null.
  onOffers?: (offers: Offer[] | null) => void;
  // Called when the bearer meets a wandering merc, then null.
  onRecruit?: (offer: Offer | null) => void;
  // Called when the bearer reaches a Waystation's post, and when it closes.
  onStation?: (open: boolean) => void;
  // Called when the layer's map opens or closes.
  onMap?: (open: boolean) => void;
  // Called when the bearer reaches a Town's well, and when its panel closes.
  onTown?: (open: boolean) => void;
}

export interface GameOptions {
  // The run seed. Random when absent.
  seed?: string;
  // Starts with these mercs instead of a pick from three offers, as tests do.
  party?: Offer['kind'][];
  // Starts in this area of the run, from 1, for tests and playtesting
  area?: number;
  // Starts at the Waystation before that area instead
  station?: boolean;
  // Starts in the Creditor's tomb, at the end of the run
  tomb?: boolean;
  // Starts in a Town, in the area given by `area`
  town?: boolean;
}

// The most mercs in the party, living or dead.
export const PARTY_SIZE = 4;

/**
 * The Guild's purse at the start of a run: enough to hire three more mercs
 * of the first stages' levels by the fires, unless they are greedy.
 */
export const START_GOLD = 3 * wageFor(START_LEVEL + 1);
// The bearer meets a wandering merc from this close, and leaves it from this far.
const MEET_REACH = 1.8;
// Each Waystation lays out from its own stream, apart from the areas'.
const WAYSTATION_STREAM = 1000;
const AREA_ROW_STREAM = 100;
const TOMB_STREAM = 2000;
// Towns stand in the first two layers only.
const TOWN_LAYERS = 2;
// The keys left to the player once the seal breaks: a merc's sheet, and restart
const FINALE_KEYS = new Set(['1', '2', '3', '4', 'escape', 'r']);
// How near the sarcophagus the bearer comes before the seal breaks, and
// below what share of health the Creditor drinks from the bearer's pack
const TOMB_REACH = 2.4;
const CREDITOR_DRINKS = 0.4;
// How near the fire the bearer must come for the party to rest at a Camp
const REST_REACH = 2.2;
// Names joined for a notice: "Odo", "Odo and Maren".
const names = (units: Unit[]): string => units.map((u) => u.name).join(' and ');
// The key for each shout, and how near the mouse an enemy must be to Focus it
const SHOUT_KEY: Record<Shout, string> = {
  [Shout.Rally]: 'z',
  [Shout.FallBack]: 'x',
  [Shout.Hold]: 'c',
  [Shout.Focus]: 'f',
};
const FOCUS_REACH = 1.5;
// Seconds a shout shows over the bearer's head
const CALLOUT_TIME = 1.2;
// Seconds a notice stays on screen
const NOTICE_TIME = 6;
const LEAVE_REACH = 4;

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
  private gearMerc: Unit | null = null;
  // What the bearer carries, and what lies on the floor
  pack = new Pack();
  private ground: GroundItem[] = [];
  // The item the bearer is walking over to pick up
  private fetching: GroundItem | null = null;
  // The offers to pick the first merc from, while the run has not begun
  private offers: Offer[] | null = null;
  // A merc waiting by its fire on this stage, and the one being talked to
  private wanderer: { offer: Offer; x: number; z: number; met: boolean } | null = null;
  // The boss of a layer's last area, while the party is in it
  private boss: Unit | null = null;
  // The party's storage for the run, and the wages owed at this Waystation
  readonly vault = new Vault();
  private payroll: Payroll | null = null;
  private stationOpen = false;
  private stationMet = false;
  private townOpen = false;
  private townMet = false;
  // A line shown under the hint for a while, such as who left unpaid
  private notice: { text: string; until: number } | null = null;
  // This layer's map, the area the party is in (null at a Waystation) and
  // the areas it has crossed
  private map: LayerMap = { columns: [] };
  private node: { column: number; row: number } | null = null;
  private path: { column: number; row: number }[] = [];
  private mapOpen = false;
  // Whether the party has rested at this area's Camp
  private rested = false;
  // Where the mouse is over the canvas, for Focus, and the bearer's last
  // shout as it shows over its head
  private pointer: { x: number; y: number } | null = null;
  // Mercs that died over the run: souls fed to the Creditor
  private souls = 0;
  // The end of the run: the Creditor, once the seal breaks, and how it ended
  private finale: { creditor: Unit; ending: 'sealed' | 'risen' | null } | null = null;
  private callout: { text: string; until: number } | null = null;
  private recruiting: Offer | null = null;
  // Impact: a short freeze on heavy hits, and screen shake in pixels.
  private hitStop = 0;
  private shake = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: GameHooks = {},
    private readonly options: GameOptions = {},
  ) {
    this.renderer = new Renderer(canvas);
    this.reset();
  }

  /** The game pauses while a merc's orders are open. */
  get paused(): boolean {
    return (
      this.selected !== null ||
      this.inventory ||
      this.offers !== null ||
      this.recruiting !== null ||
      this.stationOpen ||
      this.mapOpen ||
      this.townOpen
    );
  }

  /** The run's seed, to show and to share. */
  get seed(): string {
    return this.streams.seed;
  }

  /** Takes one of the starting offers into the party, and begins the run. */
  choose(index: number): void {
    const offer = this.offers?.[index];
    if (!offer) {
      return;
    }
    this.join(offer, this.bearer.x + 1, this.bearer.z);
    this.offers = null;
    this.hooks.onOffers?.(null);
  }

  /** Hires the wandering merc being talked to. Returns why it failed, or null. */
  hire(): string | null {
    const offer = this.recruiting;
    const w = this.wanderer;
    if (!offer || !w) {
      return null;
    }
    if (this.mercs().length >= PARTY_SIZE) {
      return `The party is full: ${PARTY_SIZE} mercs at most.`;
    }
    if (this.pack.gold < offer.wage) {
      return `${offer.name} wants ${offer.wage} gold. You have ${this.pack.gold}.`;
    }
    this.pack.gold -= offer.wage;
    this.join(offer, w.x, w.z);
    this.wanderer = null;
    this.endTalk();
    this.itemsChanged();
    return null;
  }

  /** Leaves the wandering merc where it is. Walking back to it asks again. */
  endTalk(): void {
    this.recruiting = null;
    this.hooks.onRecruit?.(null);
  }

  private join(offer: Offer, x: number, z: number): void {
    spawnMerc(this.sim, offer.kind, offer.level, x, z, undefined, {
      name: offer.name,
      traits: offer.traits,
    });
    this.views.snap(this.sim);
    this.hooks.onChange?.();
  }

  // Meets the wandering merc when the bearer walks up to it.
  private meet(): void {
    const w = this.wanderer;
    if (!w || this.recruiting) {
      return;
    }
    const d = Math.hypot(this.bearer.x - w.x, this.bearer.z - w.z);
    if (d > LEAVE_REACH) {
      w.met = false;
    } else if (d <= MEET_REACH && !w.met && this.bearer.alive) {
      w.met = true;
      this.recruiting = w.offer;
      this.keys.clear();
      this.bearer.order = null;
      this.hooks.onRecruit?.(w.offer);
    }
  }

  /**
   * Opens or closes the inventory. The game pauses while it is open. A merc
   * passed in is the one it opens on, to hand gear to.
   */
  openInventory(open: boolean, merc: Unit | null = null): void {
    this.inventory = open;
    this.gearMerc = open ? merc : null;
    this.keys.clear();
    if (open) {
      this.select(null);
    }
    this.hooks.onInventory?.(open);
  }

  /** The merc the inventory was opened for, if any. */
  get gearFor(): Unit | null {
    return this.gearMerc;
  }

  get inventoryOpen(): boolean {
    return this.inventory;
  }

  /** Hands an item from the pack to a merc. Returns why it failed, or null. */
  equip(merc: Unit, uid: number): string | null {
    const item = this.pack.items.find((i) => i.uid === uid);
    // Potions go on the belt, cards and gems into a socket, the rest is worn.
    let error: string | null;
    if (item && isPotion(item)) {
      error = packToBelt(this.sim, this.bearer, this.pack, merc, uid);
    } else if (item && isCard(item)) {
      error = socketCard(this.sim, this.bearer, this.pack, merc, uid);
    } else {
      error = equipFromPack(this.sim, this.bearer, this.pack, merc, uid);
    }
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
    this.streams = new RunStreams(this.options.seed ?? randomSeed());
    this.sim = new Sim(this.streams.get(1, Stream.Combat));
    this.stageIndex = Math.max(0, (this.options.area ?? 1) - 1);
    this.payroll = null;
    this.mapOpen = false;
    this.souls = 0;
    this.finale = null;
    this.rollMap();
    if (this.options.tomb) {
      this.stageIndex = LAYERS.length * AREAS_PER_LAYER;
      this.node = null;
      this.stage = generateTomb(this.streams.area(1, Stream.Layout, TOMB_STREAM), this.stageIndex);
    } else if (this.options.town) {
      this.goTo(this.stageIndex % AREAS_PER_LAYER, 0);
      this.stage = generateStage(
        this.streams.area(1, Stream.Layout, this.stageIndex),
        this.stageIndex,
        { kind: 'town', ahead: ['combat'] },
      );
    } else if (this.options.station) {
      this.stageIndex -= this.stageIndex % AREAS_PER_LAYER;
      this.node = null;
      this.stage = this.buildWaystation();
    } else {
      this.goTo(this.stageIndex % AREAS_PER_LAYER, 0);
      this.stage = this.buildStage();
    }
    this.views = new Views();
    this.effects = new Effects(this.sim, this.views);
    this.bearer = spawnParty(this.sim, this.stage, this.options.party ?? []);
    this.offers = this.options.party
      ? null
      : rollStartingOffers(this.streams.get(1, Stream.Recruits), START_LEVEL);
    this.recruiting = null;
    this.hooks.onOffers?.(this.offers);
    this.hooks.onRecruit?.(null);
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
          [
            ...rollDrops(this.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
            ...rollCards(this.streams.get(1, Stream.Loot), event.source.kind, event.source.rank),
          ],
          event.source,
        );
        gather(this.pack.materials, materialsFrom(this.streams.get(1, Stream.Loot), event.source));
      }
      if (event.source === this.bearer) {
        this.over = true;
      } else if (event.source.side === Side.Party) {
        this.souls++;
      }
    });
    this.slain = 0;
    this.over = false;
    this.pack = new Pack();
    this.pack.gold = START_GOLD;
    for (const [id, count] of STARTER_PACK) {
      const base = BASE_BY_ID.get(id);
      if (base) {
        this.pack.add(potionStack(base, count));
      }
    }
    this.ground = [];
    this.fetching = null;
    this.inventory = false;
    this.vault.items.length = 0;
    this.stationOpen = false;
    this.notice = null;
    this.hooks.onStation?.(false);
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

  // The area the party is in on the layer's map.
  private here(): MapNode | null {
    return this.node ? (this.map.columns[this.node.column]?.[this.node.row] ?? null) : null;
  }

  // What lies beyond each of this area's exits.
  private aheadOf(node: MapNode | null): Ahead[] {
    if (!node) {
      return this.map.columns[0].map((n) => n.kind);
    }
    if (node.kind === 'boss') {
      return ['down'];
    }
    const next = this.map.columns[(this.node?.column ?? 0) + 1];
    return node.next.map((row) => next[row].kind);
  }

  // Rolls the map of the layer the current area is in.
  private rollMap(): void {
    const layer = Math.floor(this.stageIndex / AREAS_PER_LAYER);
    // Towns stand only in the layers where people still live.
    this.map = generateLayerMap(
      this.streams.area(1, Stream.Map, layer),
      layer === 0 ? 1 : 2,
      layer < TOWN_LAYERS,
    );
    this.path = [];
  }

  // Enters an area of the layer's map, by its column and row.
  private goTo(column: number, row: number): void {
    this.node = { column, row };
    this.path.push({ column, row });
    this.stageIndex = Math.floor(this.stageIndex / AREAS_PER_LAYER) * AREAS_PER_LAYER + column;
  }

  private buildStage(): Stage {
    const node = this.here();
    const row = this.node?.row ?? 0;
    this.rested = false;
    // Each area of a column lays out from its own stream; the first keeps
    // the stream areas had before the map.
    return generateStage(
      this.streams.area(1, Stream.Layout, this.stageIndex + AREA_ROW_STREAM * row),
      this.stageIndex,
      { kind: node?.kind ?? 'combat', ahead: this.aheadOf(node) },
    );
  }

  // Lays out the current stage around the party.
  private enter(): void {
    this.boss = enterStage(this.sim, this.stage);
    const camp = this.stage.recruit;
    this.wanderer = camp
      ? {
          offer: rollOffer(
            this.streams.area(1, Stream.Recruits, this.stageIndex),
            START_LEVEL + Math.floor(this.stageIndex / 2),
          ),
          ...camp,
          met: false,
        }
      : null;
    for (const s of this.stage.stains) {
      this.effects.stain(s.x, s.z, s.r, '#560b0b');
    }
  }

  // The bearer left by the exit: on to the next area, down to the next
  // layer's Waystation, or from the Waystation into the layer's first area.
  // Party and all.
  private descend(exit: number): void {
    // Mercs whose morale broke stay behind.
    const gone = desert(this.sim);
    if (gone.length > 0) {
      this.say(`${names(gone)} ${gone.length > 1 ? 'desert' : 'deserts'} the party.`);
      this.hooks.onChange?.();
    }
    if (this.stage.station) {
      // The unpaid lose heart as the party takes the road on.
      const unpaid = this.payroll?.settle(this.sim) ?? [];
      if (unpaid.length > 0) {
        this.say(`${names(unpaid)} ${unpaid.length > 1 ? 'go' : 'goes'} on unpaid, and sullen.`);
      }
      this.payroll = null;
      this.goTo(0, exit);
      this.stage = this.buildStage();
    } else if (
      this.stage.exits[exit]?.ahead === 'down' &&
      layerIndexOf(this.stageIndex) === LAYERS.length - 1
    ) {
      // Below the Sunken Crown lies only the tomb.
      this.stageIndex++;
      this.node = null;
      this.stage = generateTomb(this.streams.area(1, Stream.Layout, TOMB_STREAM), this.stageIndex);
    } else if (this.stage.exits[exit]?.ahead === 'down') {
      this.stageIndex++;
      this.rollMap();
      this.node = null;
      this.stage = this.buildWaystation();
    } else {
      // The other roads on collapse behind the party.
      const node = this.here();
      this.goTo((this.node?.column ?? -1) + 1, node?.next[exit] ?? 0);
      this.stage = this.buildStage();
    }
    carryParty(this.sim, this.stage);
    this.effects.clear();
    // What was left on the old stage's floor is lost.
    this.ground = [];
    this.fetching = null;
    this.views.snap(this.sim);
    this.renderer.snapCamera();
    this.enter();
  }

  // The Waystation before the current area, with this layer's wages owed.
  private buildWaystation(): Stage {
    this.payroll = new Payroll();
    this.stationMet = false;
    return generateWaystation(
      this.streams.area(1, Stream.Layout, WAYSTATION_STREAM + this.stageIndex),
      this.stageIndex,
      this.aheadOf(null),
    );
  }

  // At a Camp, the party rests by the fire once: the living back to full
  // health and mana. The dead stay dead.
  private rest(): void {
    const fire = this.stage.rest;
    if (
      !fire ||
      this.rested ||
      Math.hypot(this.bearer.x - fire.x, this.bearer.z - fire.z) > REST_REACH
    ) {
      return;
    }
    this.rested = true;
    for (const u of this.sim.living(Side.Party)) {
      u.hp = u.derived.maxHp;
      u.mana = u.derived.maxMana;
      if (u !== this.bearer) {
        shiftMorale(u, RESTED);
      }
    }
    this.say('The party rests by the fire, and rises whole.');
  }

  /** Opens or closes the layer's map. The game pauses while it is open. */
  openMap(open: boolean): void {
    this.mapOpen = open;
    this.keys.clear();
    this.hooks.onMap?.(open);
  }

  /** This layer's map, the areas crossed, and where the party is now. */
  layerMap(): {
    map: LayerMap;
    path: { column: number; row: number }[];
    at: { column: number; row: number } | null;
    layer: number;
  } {
    return {
      map: this.map,
      path: [...this.path],
      at: this.node,
      layer: Math.floor(this.stageIndex / AREAS_PER_LAYER),
    };
  }

  // At the tomb the seal breaks, and the bearer becomes the Creditor.
  private breakSeal(): void {
    const tomb = this.stage.tomb;
    if (
      !tomb ||
      this.finale ||
      !this.bearer.alive ||
      Math.hypot(this.bearer.x - tomb.x, this.bearer.z - tomb.z) > TOMB_REACH
    ) {
      return;
    }
    const level = monsterLevel(this.stageIndex) + 2;
    const r = reveal(this.sim, this.bearer, level, this.souls);
    this.finale = { creditor: r.creditor, ending: null };
    this.boss = r.creditor;
    this.select(null);
    this.openInventory(false);
    this.keys.clear();
    this.shake = Math.max(this.shake, 6);
    const lines = ['The seal breaks. The Writ was never a letter.'];
    if (r.raised.length > 0) {
      lines.push(`${names(r.raised)} ${r.raised.length > 1 ? 'rise' : 'rises'} for it.`);
    }
    if (r.fled.length > 0) {
      lines.push(`${names(r.fled)} ${r.fled.length > 1 ? 'run' : 'runs'}.`);
    }
    this.say(lines.join(' '));
    this.views.snap(this.sim);
    this.hooks.onChange?.();
  }

  // The Creditor drinks what the bearer carried, and the fight ends when it
  // or the last merc falls.
  private endFinale(): void {
    const f = this.finale;
    if (!f || f.ending) {
      return;
    }
    const c = f.creditor;
    if (c.alive && c.hp < c.derived.maxHp * CREDITOR_DRINKS) {
      const potion = this.pack.healingPotion();
      if (potion && c.drink(potion)) {
        this.pack.tidy();
        this.itemsChanged();
      }
    }
    if (!c.alive) {
      f.ending = 'sealed';
    } else if (this.sim.living(Side.Party).length === 0) {
      f.ending = 'risen';
    }
    if (f.ending) {
      this.over = true;
    }
  }

  private say(text: string): void {
    this.notice = { text, until: this.time + NOTICE_TIME };
  }

  // Opens the Waystation's post when the bearer walks up to it.
  private visitStation(): void {
    const post = this.stage.station;
    if (!post || this.stationOpen) {
      return;
    }
    const d = Math.hypot(this.bearer.x - post.x, this.bearer.z - post.z);
    if (d > LEAVE_REACH) {
      this.stationMet = false;
    } else if (d <= MEET_REACH && !this.stationMet && this.bearer.alive) {
      this.stationMet = true;
      this.stationOpen = true;
      this.keys.clear();
      this.bearer.order = null;
      this.hooks.onStation?.(true);
    }
  }

  // Opens the Town's panel when the bearer walks up to the well.
  private visitTown(): void {
    const well = this.stage.town;
    if (!well || this.townOpen) {
      return;
    }
    const d = Math.hypot(this.bearer.x - well.x, this.bearer.z - well.z);
    if (d > LEAVE_REACH) {
      this.townMet = false;
    } else if (d <= MEET_REACH && !this.townMet && this.bearer.alive) {
      this.townMet = true;
      this.townOpen = true;
      this.keys.clear();
      this.bearer.order = null;
      this.hooks.onTown?.(true);
    }
  }

  /** Closes the Town's panel. Walking back to the well opens it again. */
  closeTown(): void {
    this.townOpen = false;
    this.hooks.onTown?.(false);
  }

  /** Every item the smith can work on: the pack's, then what each merc wears. */
  smithable(): { item: Item; merc: Unit | null }[] {
    return [
      ...this.pack.items.filter((i) => refinable(i)).map((item) => ({ item, merc: null })),
      ...this.mercs().flatMap((merc) =>
        [...merc.equipment.values()].map((item) => ({ item, merc })),
      ),
    ];
  }

  // Where an item is, so a broken one can be taken from there.
  private remove(item: Item): void {
    if (this.pack.take(item.uid)) {
      return;
    }
    for (const merc of this.mercs()) {
      for (const [slot, worn] of merc.equipment) {
        if (worn === item) {
          merc.unequip(slot);
        }
      }
    }
  }

  private get craftRng(): RNG {
    return this.streams.get(1, Stream.Craft);
  }

  /** The smith refines an item one level. Returns what happened. */
  refineItem(item: Item, bless: boolean): string {
    const why = cannotRefine(this.pack, item);
    if (why) {
      return why;
    }
    const name = itemName(item);
    const result = refine(this.craftRng, this.pack, item, bless);
    if (result === 'broken') {
      this.remove(item);
    }
    for (const merc of this.mercs()) {
      merc.recalc();
    }
    this.itemsChanged();
    if (result === 'refined') {
      return `${name} is now +${item.refine}.`;
    }
    return result === 'held'
      ? `The refine failed. The Blessing kept ${name}, at +${item.refine}.`
      : `The refine failed. ${name} broke, with every card in it.`;
  }

  /** The smith adds a socket. Returns what happened. */
  socketItem(item: Item): string {
    const why = cannotAddSocket(this.pack, item);
    if (why) {
      return why;
    }
    const name = itemName(item);
    const result = addSocket(this.craftRng, this.pack, item);
    if (result === 'broken') {
      this.remove(item);
    }
    this.itemsChanged();
    return result === 'added'
      ? `${name} now has ${item.sockets} sockets.`
      : `The punch slipped. ${name} broke.`;
  }

  /** The bench makes a recipe. Returns why it could not, or null. */
  craft(recipe: Recipe): string | null {
    const why = craft(this.craftRng, this.pack, recipe, monsterLevel(this.stageIndex));
    this.itemsChanged();
    return why;
  }

  /** The bench breaks a pack item down into materials. */
  salvage(uid: number): string | null {
    const why = salvageItem(this.pack, uid);
    this.itemsChanged();
    return why;
  }

  /** The Temple raises a dead merc. */
  raise(merc: Unit): string | null {
    const why = raise(this.pack, merc);
    this.views.snap(this.sim);
    this.itemsChanged();
    return why;
  }

  /** The Market sells a potion. */
  buy(id: string): string | null {
    const why = buy(this.pack, id);
    this.itemsChanged();
    return why;
  }

  /** The Market buys a pack item. */
  sell(uid: number): string | null {
    const why = sell(this.pack, uid);
    this.itemsChanged();
    return why;
  }

  /** Closes the Waystation's post. Walking back to it opens it again. */
  closeStation(): void {
    this.stationOpen = false;
    this.hooks.onStation?.(false);
  }

  /** The wages owed at this Waystation, or none elsewhere. */
  dues(): Due[] {
    return this.payroll?.dues(this.sim) ?? [];
  }

  /** Pays one merc's wage. Returns why it could not, or null. */
  pay(merc: Unit): string | null {
    const why = this.payroll?.pay(this.pack, merc) ?? 'Wages are paid only at a Waystation.';
    this.itemsChanged();
    return why;
  }

  /** Moves an item from the pack into the vault, at a Waystation only. */
  store(uid: number): string | null {
    const why = this.stage.station
      ? storeInVault(this.pack, this.vault, uid)
      : 'The vault opens only at a Waystation.';
    this.itemsChanged();
    return why;
  }

  /** Moves an item from the vault into the pack, at a Waystation only. */
  takeOut(uid: number): string | null {
    const why = this.stage.station
      ? takeFromVault(this.pack, this.vault, uid)
      : 'The vault opens only at a Waystation.';
    this.itemsChanged();
    return why;
  }

  start(): void {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.last = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    cancelAnimationFrame(this.frameId);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      this.select(null);
      this.openInventory(false);
      if (this.stationOpen) {
        this.closeStation();
      }
      if (this.mapOpen) {
        this.openMap(false);
      }
      if (this.townOpen) {
        this.closeTown();
      }
      return;
    }
    // Once the seal breaks, the player can only look at the mercs, or start
    // another run.
    if (this.finale && !FINALE_KEYS.has(key)) {
      return;
    }
    if (key === 'q' && !this.over && !this.paused) {
      this.drinkHealing();
      return;
    }
    const shout = ALL_SHOUTS.find((s) => SHOUT_KEY[s] === key);
    if (shout !== undefined) {
      this.shout(shout);
      return;
    }
    if (key === 'm' && !this.over && this.offers === null) {
      this.openMap(!this.mapOpen);
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

  private readonly onMouseMove = (e: MouseEvent): void => {
    this.pointer = { x: e.clientX, y: e.clientY };
  };

  // The enemy in sight nearest the mouse, within a tile and a half of it.
  private enemyAtPointer(): Unit | null {
    if (!this.pointer) {
      return null;
    }
    const p = this.renderer.unproject(this.pointer.x, this.pointer.y);
    let best: Unit | null = null;
    let bestD = FOCUS_REACH;
    for (const m of this.sim.living(Side.Monster)) {
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < bestD && this.renderer.sees(m.x, m.z)) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * The bearer shouts. Focus marks the enemy under the mouse. Returns why it
   * could not, or null.
   */
  shout(shout: Shout): string | null {
    if (this.over || this.paused) {
      return null;
    }
    const why = cry(this.sim, shout, shout === Shout.Focus ? this.enemyAtPointer() : null);
    if (why) {
      this.say(why);
      return why;
    }
    this.callout = { text: `${SHOUTS[shout].name}!`, until: this.time + CALLOUT_TIME };
    this.effects.shout(this.bearer);
    return null;
  }

  /** Each shout's key, name and seconds until it is ready again. */
  shoutBar(): { shout: Shout; key: string; name: string; left: number; cooldown: number }[] {
    return ALL_SHOUTS.map((shout) => ({
      shout,
      key: SHOUT_KEY[shout],
      name: SHOUTS[shout].name,
      left: cooldownLeft(this.sim, shout),
      cooldown: SHOUTS[shout].cooldown,
    }));
  }

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (this.over) {
      return;
    }
    if (this.finale) {
      this.select(this.pickMerc(e.clientX, e.clientY));
      return;
    }
    // Clicking a merc opens its orders. Clicking anywhere else closes them,
    // or walks the bearer there.
    if (this.inventory) {
      return;
    }
    // An item's label comes first: it may sit right over a merc.
    const labelled = this.paused ? null : this.renderer.labelAt(e.clientX, e.clientY);
    if (labelled) {
      this.fetching = labelled;
      this.bearer.order = { x: labelled.x, z: labelled.z };
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
    // Once the seal breaks, the player no longer moves anyone.
    if (this.finale) {
      return;
    }
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
        this.meet();
        this.visitStation();
        this.visitTown();
        this.acc -= TICK;
        if (shutArena(this.sim, this.stage, this.boss)) {
          // The gate slams shut behind the party.
          this.shake = Math.max(this.shake, 4);
        }
        this.rest();
        this.breakSeal();
        this.endFinale();
        // The way down opens only once the boss is dead.
        const exit = this.stage.exits.findIndex(
          (e) =>
            this.bearer.distanceTo(e) <= EXIT_REACH && !(e.ahead === 'down' && this.boss?.alive),
        );
        if (this.bearer.alive && exit >= 0) {
          this.descend(exit);
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
      ground: this.ground,
      wanderer: this.wanderer,
      over: this.over,
      ending: this.finale?.ending ?? null,
      paused: this.paused,
      selected: this.selected,
      shake: this.shake,
      boss: this.boss,
      notice: this.notice && this.notice.until > this.time ? this.notice.text : null,
      callout: this.callout && this.callout.until > this.time ? this.callout.text : null,
    });
    // Exposed for browser tests, which cannot see inside the canvas.
    this.canvas.dataset.bearer = `${this.bearer.x.toFixed(2)},${this.bearer.z.toFixed(2)}`;
    const cam = this.renderer.camera;
    this.canvas.dataset.camera = `${cam.x},${cam.y}`;
    // How the final fight stands: not begun, under way, or how it ended.
    this.canvas.dataset.finale = this.finale ? (this.finale.ending ?? 'fighting') : 'none';
    // Each merc's feet, as shares of the canvas, so tests can click them.
    this.canvas.dataset.mercs = this.mercs()
      .map((m) => {
        const p = this.renderer.shareOnScreen(m.x, m.z);
        return `${m.name}:${p.x.toFixed(4)},${p.y.toFixed(4)}`;
      })
      .join(';');
  }
}

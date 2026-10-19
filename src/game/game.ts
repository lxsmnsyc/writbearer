import { EventPriority } from '../core/event-emitter';
import { RunStreams, Stream, normalizeSeed, randomSeed } from '../core/seed';
import { SimEvents } from '../sim/events';
import { look } from '../render/rig';
import Sim, { TICK } from '../sim/sim';
import { DamageFlags, DamagePriority, Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { Effects } from '../render/effects';
import Renderer, { EXIT_PLATE, type Frame } from '../render/renderer';
import { Views } from '../render/view';
import {
  type Ahead,
  type AreaPlan,
  type Exit,
  type ExitSide,
  type Fight,
  type Gate,
  type Prop,
  type Stage,
  generateGuild,
  generateStage,
  generateTomb,
  generateWaystation,
  monsterLevel,
  openGate,
  rectOf,
  withFightsAhead,
} from '../gen/stage';
import { reveal } from '../content/creditor';
import { EVENT_BY_ID, type EventDef, type EventPlay, pickEvent } from '../content/events';
import {
  CHALLENGE_NAME,
  type LayerMap,
  MUTATOR_NAME,
  MUTATOR_TEXT,
  type MapNode,
  OBJECTIVE_NAME,
  type Objective,
  REWARD_NAME,
  type Reward,
  generateLayerMap,
} from '../gen/graph';
import { AREAS_PER_LAYER, LAYERS, layerIndexOf } from '../gen/layers';
import {
  type EquipSlot,
  type Item,
  type ItemBase,
  Quality,
  isCard,
  isPotion,
  refinable,
} from '../sim/item';
import { BASE_BY_ID, STARTER_PACK } from '../content/items';
import {
  itemName,
  plainItem,
  potionStack,
  rollCards,
  rollDrops,
  rollGold,
  rollItem,
  rollPotion,
  rollSetPiece,
  rollUnique,
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
import { Compendium, type Ending } from './compendium';
import ObjectiveRun from './objective';
import Hazards from './hazards';
import {
  type RunSave,
  SAVE_VERSION,
  deleteSave,
  loadMerc,
  loadPack,
  saveItem,
  saveMerc,
  writeSave,
} from './save';
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
import { CARD_OF, GEMS } from '../content/cards';
import { MATERIAL_NAME, type Materials, gather, materialsFrom } from '../content/materials';
import type { Recipe } from '../content/recipes';
import RNG from '../core/rng';
import { RESTED, shiftMorale } from '../sim/morale';
import { ALL_SHOUTS, SHOUTS, Shout, cooldownLeft, cry } from '../sim/shout';
import { FIGHTERS, type Offer, rollOffer, rollStartingOffers, wageFor } from '../content/recruits';
import { MERCS, MONSTERS, type MonsterKind, spawnMerc } from '../content/roster';
import { applySets } from '../content/sets';
import {
  START_LEVEL,
  carryParty,
  dropStage,
  enterStage,
  joinStage,
  spawnParty,
  wakeBoss,
} from './stage';
import { placeBeyond } from '../gen/place';
import Bonus, { type BonusState } from './bonus';
import MutatorRun from './mutators';
import { type Rect, inRect } from '../sim/nav';

// Never simulate more than this much time in one frame, so a stalled tab
// does not fast-forward the fight.
const MAX_FRAME = 0.25;
// The bearer leaves by the exit once this close to it.
const EXIT_REACH = 1.2;
// The bearer picks up an item, or opens a chest, from this close.
const PICK_REACH = 0.8;
const CHEST_REACH = 1.3;
// The bearer pulls a lever from this close.
const LEVER_REACH = 1.3;
// How near a click must land to a chest, in tiles, to open it
const CHEST_PICK = 1.1;
// How far a chest blocks bodies, as the stage's chests do
const CHEST_SOLID = 0.35;
// A chest holds this many pieces of equipment, rolled as an elite's drop.
const CHEST_ITEMS = 3;
// A fight's chest holds one, and an Arms chest this many more, Magic or better.
const ARMS_ITEMS = 2;
// A Gold chest's pile is this many times a monster's.
const GOLD_PILE = 4;
// What a Materials chest puts in the pouch, and a Smith's Blessing from this layer down
const MATERIALS_PAID: readonly [string, number][] = [
  ['iron', 2],
  ['chitin', 1],
  ['bone', 1],
  ['rag', 1],
];
const ESSENCES = ['venomEssence', 'occultEssence', 'radiantEssence'];
const BLESSING_FROM_LAYER = 2;
// What meeting a bonus challenge adds, by the reward, for the badge
const BONUS_PAYS: Record<Reward, string> = {
  gold: 'Twice the gold.',
  arms: 'One item is Rare or better.',
  cards: 'A second card.',
  materials: 'Twice the materials.',
  respite: 'The dead rise too.',
};

/** Monsters of one kind in a Horde's next wave, as the HUD shows them. */
export interface ComingGroup {
  kind: MonsterKind;
  name: string;
  count: number;
}

/** The world as the map draws it. See `Game.automap`. */
export interface Automap {
  areas: Stage[];
  here: Stage;
  bearer: { x: number; z: number };
  known: (stage: Stage, x: number, z: number) => boolean;
  exits: { exit: Exit; shut: boolean }[];
}

/** A fight's bonus challenge as the HUD shows it. */
export interface BonusStatus {
  title: string;
  detail: string;
  state: BonusState;
}
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
  // Called when the title panel opens at the start of a run, with the run's
  // seed, and when the bearer sets out into the Guild House.
  onTitle?: (open: boolean, seed: string) => void;
  // Called when the bearer meets a wandering merc, then null.
  onRecruit?: (offer: Offer | null) => void;
  // Called when the bearer reaches a Waystation's post, and when it closes.
  onStation?: (open: boolean) => void;
  // Called when the layer's map opens or closes.
  onMap?: (open: boolean) => void;
  // Called when the bearer reaches a Town's well, and when its panel closes.
  onTown?: (open: boolean) => void;
  // Called when the bearer walks up to an Event, as it changes, and with
  // null when it closes.
  onEvent?: (event: EventView | null) => void;
  // Called when the compendium opens or closes.
  onCompendium?: (open: boolean) => void;
}

/** An Event as the interface shows it. */
export interface EventView {
  title: string;
  text: string;
  // Each choice, and why it cannot be made now, if it cannot
  choices: { label: string; why: string | null }[];
  // What came of the choice made, once made
  outcome: string | null;
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
  // Starts at this Event, by its id, in the area given by `area`
  event?: string;
  // Plays endless mode: numbered phases without end, and no Writ
  endless?: boolean;
  // Gives the first fight this objective, for tests and playtesting
  objective?: Objective;
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
// A rectangle a tile in from each edge, so crossing means being well inside
const inner = (r: Rect): Rect => ({ x0: r.x0 + 1, z0: r.z0 + 1, x1: r.x1 - 1, z1: r.z1 - 1 });
// Which edges each area's exits leave by, rolled apart from its layout
const SIDES_STREAM = 20000;
// How long the area behind waits for the party before it collapses, and
// how long its floor takes to fade, in seconds
const COLLAPSE_WAIT = 4;
const COLLAPSE_FADE = 1.5;
const TOMB_STREAM = 2000;
const GUILD_STREAM = 3000;
// Towns stand in the first two layers only.
const TOWN_LAYERS = 2;
// Each endless phase rolls its biome from its own stream.
const ENDLESS_BIOME = 10000;
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
  // The item the bearer is walking over to pick up, the chest it is
  // walking to open and the exit it is walking to leave by. Each is done
  // only once clicked, so walking past never opens or leaves by accident.
  private fetching: GroundItem | null = null;
  private opening: Prop | null = null;
  private leaving: number | null = null;
  private seeking: { offer: Offer; x: number; z: number; met: boolean } | null = null;
  // The exit under the mouse, drawn brighter
  private hoverExit: number | null = null;
  // What this area asks before its exits open, and whether it is done
  private objective: ObjectiveRun | null = null;
  // The area joined beyond the exit the party took, with its boss, before
  // the party crosses into it; and the area behind, until it collapses, and
  // its floor as it fades
  private ahead: { stage: Stage; boss: Unit | null } | null = null;
  private behind: { stage: Stage; t: number } | null = null;
  private fading: { stage: Stage; t: number } | null = null;
  // A Labyrinth's traps, and whether the bearer was hurt in this area
  private hazards: Hazards | null = null;
  // What this fight's chest holds once its objective is done, its bonus
  // challenge, and whether that was met once the objective was done
  private prize: Reward | null = null;
  private bonus: Bonus | null = null;
  private bonusMet: boolean | null = null;
  // The rules this fight's mutators change
  private mutators!: MutatorRun;
  // Whether the title panel is up, before the run begins
  private title = false;
  // The recruits rolled for the Guild House at the start of the run
  private starting: Offer[] = [];
  // A merc waiting by its fire on this stage, and the one being talked to
  private wanderers: { offer: Offer; x: number; z: number; met: boolean }[] = [];
  // The boss of a layer's last area, while the party is in it
  private boss: Unit | null = null;
  // The party's storage for the run, and the wages owed at this Waystation
  readonly vault = new Vault();
  private payroll: Payroll | null = null;
  private stationOpen = false;
  private stationMet = false;
  private townOpen = false;
  private townMet = false;
  // The Event of this area, as it plays out, and the ones met on this run
  private encounter: {
    def: EventDef;
    play: EventPlay;
    at: { x: number; z: number };
    outcome: string | null;
    met: boolean;
    // Its stream as it stood before it began, for the save
    state: number;
  } | null = null;
  private pendingEvent: { def: EventDef; rng: RNG; state: number } | null = null;
  private eventOpen = false;
  private readonly eventsSeen = new Set<string>();
  // What the player has found over every run, and whether it is open
  readonly compendium: Compendium;
  private compendiumOpen = false;
  // Endless mode: phases without end, each on a biome rolled from every
  // layer's, recruits in all of them, no Writ and no Creditor
  private endless = false;
  private chosenEndless: boolean;
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
  private recruiting: { offer: Offer; x: number; z: number; met: boolean } | null = null;
  // Impact: a short freeze on heavy hits, and screen shake in pixels.
  private hitStop = 0;
  private shake = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: GameHooks = {},
    private readonly options: GameOptions = {},
  ) {
    this.renderer = new Renderer(canvas);
    this.compendium = new Compendium(this.saving);
    this.chosenEndless = options.endless ?? false;
    this.reset();
  }

  /** The game pauses while a merc's orders are open. */
  get paused(): boolean {
    return (
      this.selected !== null ||
      this.inventory ||
      this.title ||
      this.recruiting !== null ||
      this.stationOpen ||
      this.mapOpen ||
      this.townOpen ||
      this.eventOpen ||
      this.compendiumOpen
    );
  }

  /** The run's seed, to show and to share. */
  get seed(): string {
    return this.streams.seed;
  }

  /** Closes the title panel: the bearer stands in the Guild House. */
  setOut(): void {
    this.title = false;
    this.hooks.onTitle?.(false, this.streams.seed);
  }

  // What a recruit asks to join: nothing for the first, which the Guild pays.
  private priceOf(offer: Offer): number {
    return this.stage.kind === 'guild' && this.mercs().length === 0 ? 0 : offer.wage;
  }

  // Whether the party has a merc that can kill what attacks the bearer.
  private get hasFighter(): boolean {
    return this.mercs().some((m) => m.alive && (FIGHTERS as readonly string[]).includes(m.kind));
  }

  /** Resumes a saved run at the entrance of the area it was saved in. */
  resume(save: RunSave): void {
    this.reset(save);
  }

  // A run begins at the Guild House, unless started at a chosen place or
  // with a party, as tests and playtesting do.
  private get startsAtGuild(): boolean {
    return this.saving && !this.options.party;
  }

  // Whether this run keeps a save: not one started at a chosen place, as
  // tests and playtesting do, so they never touch the player's run.
  private get saving(): boolean {
    const o = this.options;
    const placed = [o.party, o.area, o.event, o.objective].some((v) => v !== undefined);
    return !placed && !o.station && !o.tomb && !o.town;
  }

  // Writes the run as it stands at this area's entrance.
  private persist(): void {
    if (this.saving && !this.over) {
      writeSave(this.snapshot());
    }
  }

  // The run is over, won or lost: its save goes with it, and the
  // compendium notes how it ended.
  private endRun(ending: Ending): void {
    if (this.saving) {
      deleteSave();
    }
    if (this.endless) {
      // Endless runs only fall; the compendium keeps the deepest phase.
      this.compendium.reach(Math.floor(this.stageIndex / AREAS_PER_LAYER) + 1);
    } else {
      this.compendium.end(ending);
    }
  }

  /** Opens or closes the compendium. The game pauses while it is open. */
  openCompendium(open: boolean): void {
    this.compendiumOpen = open;
    this.keys.clear();
    this.hooks.onCompendium?.(open);
  }

  /** The run as it stands, for the save. Taken on entering an area. */
  snapshot(): RunSave {
    const e = this.encounter;
    return {
      version: SAVE_VERSION,
      seed: this.streams.seed,
      endless: this.endless,
      streams: this.streams.save(),
      stageIndex: this.stageIndex,
      node: this.node && { ...this.node },
      path: this.path.map((p) => ({ ...p })),
      stage: structuredClone(this.stage),
      event: e && { id: e.def.id, state: e.state },
      eventsSeen: [...this.eventsSeen],
      souls: this.souls,
      slain: this.slain,
      bearer: { hp: this.bearer.hp, mana: this.bearer.mana },
      mercs: this.mercs().map((m) => saveMerc(m)),
      gold: this.pack.gold,
      pack: this.pack.items.map((i) => saveItem(i)),
      materials: [...this.pack.materials],
      vault: this.vault.items.map((i) => saveItem(i)),
    };
  }

  // Lays out the saved area again, as it stood when the party entered it.
  private resumeArea(save: RunSave): void {
    this.node = save.node && { ...save.node };
    this.path = save.path.map((p) => ({ ...p }));
    this.stage = structuredClone(save.stage);
    for (const id of save.eventsSeen) {
      this.eventsSeen.add(id);
    }
    const def = save.event && EVENT_BY_ID.get(save.event.id);
    this.pendingEvent =
      save.event && def ? { def, rng: new RNG(save.event.state), state: save.event.state } : null;
    this.rested = false;
    if (this.stage.station) {
      this.payroll = new Payroll();
      this.stationMet = false;
    }
  }

  /** Hires the merc being talked to. Returns why it failed, or null. */
  hire(): string | null {
    const w = this.recruiting;
    if (!w) {
      return null;
    }
    const { offer } = w;
    if (this.mercs().length >= PARTY_SIZE) {
      return `The party is full: ${PARTY_SIZE} mercs at most.`;
    }
    const price = this.priceOf(offer);
    if (this.pack.gold < price) {
      return `${offer.name} wants ${price} gold. You have ${this.pack.gold}.`;
    }
    this.pack.gold -= price;
    this.join(offer, w.x, w.z);
    this.wanderers = this.wanderers.filter((x) => x !== w);
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
    const merc = spawnMerc(this.sim, offer.kind, offer.level, x, z, undefined, {
      name: offer.name,
      traits: offer.traits,
    });
    this.compendium.meet({
      name: merc.name,
      job: merc.job.name,
      traits: offer.traits,
      level: offer.level,
    });
    this.views.snap(this.sim);
    this.hooks.onChange?.();
  }

  // Meets a recruit when the bearer walks up to it.
  private meet(): void {
    if (this.recruiting) {
      return;
    }
    // Only the recruit the bearer was sent to: walking past one asks nothing.
    for (const w of this.wanderers) {
      const d = Math.hypot(this.bearer.x - w.x, this.bearer.z - w.z);
      if (w === this.seeking && d <= MEET_REACH && this.bearer.alive) {
        this.seeking = null;
        w.met = true;
        this.compendium.meet({
          name: w.offer.name,
          job: MERCS[w.offer.kind].job.name,
          traits: w.offer.traits,
          level: w.offer.level,
        });
        this.recruiting = w;
        this.keys.clear();
        this.bearer.order = null;
        this.hooks.onRecruit?.({ ...w.offer, wage: this.priceOf(w.offer) });
        return;
      }
    }
  }

  /** Whether the merc being talked to waits at the Guild House, and not by a fire. */
  get atGuild(): boolean {
    return this.stage.kind === 'guild';
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
    applySets(this.sim);
    // Whatever the party holds counts as acquired.
    for (const item of this.pack.items) {
      this.compendium.acquire(item);
    }
    for (const merc of this.mercs()) {
      for (const item of merc.equipment.values()) {
        this.compendium.acquire(item);
      }
    }
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

  /** Starts a new run, or resumes a saved one at its area's entrance. */
  reset(save: RunSave | null = null, seed = this.options.seed): void {
    this.streams = save
      ? RunStreams.load(save.seed, save.streams)
      : new RunStreams(seed ?? randomSeed());
    this.endless = save?.endless ?? this.chosenEndless;
    // The pack comes first: an Event the run starts at deals with it.
    this.pack = new Pack();
    this.pack.gold = START_GOLD;
    this.vault.items.length = 0;
    if (save) {
      loadPack(save, this.pack, this.vault);
    } else {
      for (const [id, count] of STARTER_PACK) {
        const base = BASE_BY_ID.get(id);
        if (base) {
          this.pack.add(potionStack(base, count));
        }
      }
    }
    this.sim = new Sim(this.streams.get(1, Stream.Combat));
    this.walked = [];
    this.renderer.forgetAreas([]);
    this.mutators = new MutatorRun(this.sim, () => monsterLevel(this.stageIndex));
    this.stageIndex = save?.stageIndex ?? Math.max(0, (this.options.area ?? 1) - 1);
    this.payroll = null;
    this.mapOpen = false;
    this.souls = 0;
    this.finale = null;
    this.eventsSeen.clear();
    this.eventOpen = false;
    this.rollMap();
    if (save) {
      this.resumeArea(save);
    } else if (this.options.tomb) {
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
    } else if (this.options.event) {
      this.goTo(this.stageIndex % AREAS_PER_LAYER, 0);
      this.stage = this.buildStage('event');
    } else if (this.options.station) {
      this.stageIndex -= this.stageIndex % AREAS_PER_LAYER;
      this.node = null;
      this.stage = this.buildWaystation();
    } else if (this.startsAtGuild) {
      this.node = null;
      this.stage = generateGuild(
        this.streams.area(1, Stream.Layout, GUILD_STREAM),
        this.aheadOf(null),
        this.sidesFor(this.aheadOf(null).length, GUILD_STREAM),
      );
      withFightsAhead(this.stage, this.fightsAhead(null));
    } else {
      this.goTo(this.stageIndex % AREAS_PER_LAYER, 0);
      this.stage = this.buildStage();
    }
    this.views = new Views();
    this.effects = new Effects(this.sim, this.views);
    this.bearer = spawnParty(this.sim, this.stage, this.options.party ?? []);
    if (save) {
      this.bearer.hp = save.bearer.hp;
      this.bearer.mana = save.bearer.mana;
      for (const m of save.mercs) {
        loadMerc(this.sim, m, this.stage.entrance.x, this.stage.entrance.z);
      }
      carryParty(this.sim, this.stage);
      this.views.snap(this.sim);
    }
    this.starting =
      this.stage.kind === 'guild'
        ? rollStartingOffers(this.streams.get(1, Stream.Recruits), START_LEVEL)
        : [];
    this.title = !save && this.stage.kind === 'guild';
    this.recruiting = null;
    this.hooks.onTitle?.(this.title, this.streams.seed);
    this.hooks.onRecruit?.(null);
    this.enter();
    this.sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.target === this.bearer && event.value > 0) {
        this.bonus?.hurt();
      }
      if (event.value < HEAVY_HIT || event.flags & DamageFlags.DoT) {
        return;
      }
      this.hitStop = Math.max(this.hitStop, HIT_STOP);
      this.shake = Math.max(this.shake, Math.min(MAX_SHAKE, event.value / 12));
    });
    // A merc that rises puts its set pieces back into the count.
    this.sim.on(SimEvents.UnitRevived, EventPriority.Post, () => {
      applySets(this.sim);
    });
    this.sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      // The key to a Labyrinth's hall falls where its bearer dies.
      if (event.source.bearsKey) {
        const { x, z } = event.source;
        this.stage.props.push({ kind: 'key', x, z, seed: 0.5 });
        this.say('The key to the hall falls from the dead.');
      }
      if (event.source.side === Side.Monster) {
        this.slain++;
        this.compendium.beat(event.source.kind);
        this.shareXp(event.source);
        this.scatter(
          [
            ...rollDrops(this.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
            ...rollCards(this.streams.get(1, Stream.Loot), event.source.kind, event.source.rank),
            ...[
              rollUnique(this.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
              rollSetPiece(this.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
            ].filter((i) => i !== null),
          ],
          event.source,
        );
        gather(this.pack.materials, materialsFrom(this.streams.get(1, Stream.Loot), event.source));
      }
      // A merc's death takes its set pieces out of the count.
      if (event.source.side === Side.Party) {
        applySets(this.sim);
      }
      if (event.source === this.bearer) {
        this.over = true;
        this.endRun('fallen');
      } else if (event.source.side === Side.Party) {
        this.souls++;
        this.bonus?.lost();
      }
    });
    this.slain = save?.slain ?? 0;
    this.souls = save?.souls ?? 0;
    this.over = false;
    this.ground = [];
    this.goFor();
    this.inventory = false;
    this.stationOpen = false;
    this.notice = null;
    this.hooks.onStation?.(false);
    this.hooks.onEvent?.(null);
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
      this.compendium.seeDrop(item);
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
      if (p === this.opening && !p.open && b.distanceTo(p) <= CHEST_REACH) {
        p.open = true;
        this.opening = null;
        const rng = this.streams.get(1, Stream.Loot);
        const level = 4 + this.stageIndex;
        if (p.holds) {
          const extra = Array.from({ length: p.extra ?? 0 }, () =>
            rollItem(rng, level, Rank.Elite),
          );
          this.scatter([...this.spoilsOf(p.holds, rng, level, p.better === true), ...extra], p);
          continue;
        }
        const items = Array.from({ length: CHEST_ITEMS }, () => rollItem(rng, level, Rank.Elite));
        this.scatter([...items, rollGold(rng, level), rollPotion(rng, level, 2)], p);
      }
    }
  }

  // What a fight's chest holds: an item, gold and potions, and its reward,
  // upgraded if the bonus challenge was met.
  private spoilsOf(reward: Reward, rng: RNG, level: number, better: boolean): Item[] {
    const gold = rollGold(rng, level);
    const out = [rollItem(rng, level, Rank.Elite), gold, rollPotion(rng, level, 2)];
    const more = better ? 2 : 1;
    if (reward === 'gold') {
      gold.quantity *= GOLD_PILE * more;
    } else if (reward === 'arms') {
      const jobs = this.mercs()
        .filter((m) => m.alive)
        .map((m) => m.job.name);
      for (let i = 0; i < ARMS_ITEMS; i++) {
        const job = jobs.length > 0 ? rng.pick(jobs) : undefined;
        const atLeast = better && i === 0 ? Quality.Rare : Quality.Magic;
        out.push(rollItem(rng, level, Rank.Elite, { atLeast, job }));
      }
    } else if (reward === 'cards') {
      for (let i = 0; i < more; i++) {
        out.push(plainItem(this.cardHere(rng)));
      }
    } else if (reward === 'materials') {
      const found: Materials = new Map(MATERIALS_PAID.map(([id, n]) => [id, n * more]));
      found.set(rng.pick(ESSENCES), 2 * more);
      if (Math.floor(this.stageIndex / AREAS_PER_LAYER) >= BLESSING_FROM_LAYER) {
        found.set('blessing', 1);
      }
      gather(this.pack.materials, found);
      this.say(`The chest holds ${materialList(found)}. They go in the pouch.`);
    }
    return out;
  }

  // The card of a monster of this area, or a gem if none has one.
  private cardHere(rng: RNG): ItemBase {
    const kinds = [
      ...this.stage.packs.flatMap((p) => p.kinds),
      ...(this.stage.waves ?? []).flatMap((w) => w.kinds),
    ];
    const cards = kinds.map((k) => CARD_OF.get(k)).filter((c) => c !== undefined);
    return cards.length > 0 ? rng.pick(cards) : rng.pick(GEMS);
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

  // The areas walked in this layer, in order, for the map
  private walked: Stage[] = [];

  /**
   * The world as the map draws it: the areas walked in this layer and the
   * one joined ahead, where they lie, the bearer, and the exits of the
   * area it is in, each with what lies beyond.
   */
  automap(): Automap {
    const ahead = this.ahead?.stage;
    const areas =
      ahead && !this.walked.includes(ahead) ? [...this.walked, ahead] : [...this.walked];
    return {
      areas,
      here: this.stage,
      bearer: { x: this.bearer.x, z: this.bearer.z },
      known: (stage, x, z) => this.renderer.knownIn(stage, x, z),
      exits: this.stage.exits
        .filter((e) => e.closed !== true)
        .map((e) => ({ exit: e, shut: !this.exitsOpen })),
    };
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

  // The areas beyond each of this area's exits, for their signposts.
  private fightsAhead(node: MapNode | null): (Fight | undefined)[] {
    if (!node) {
      return this.map.columns[0];
    }
    const next = this.map.columns[(this.node?.column ?? 0) + 1] ?? [];
    return node.kind === 'boss' ? [] : node.next.map((row) => next[row]);
  }

  // Rolls the map of the layer the current area is in.
  private rollMap(): void {
    const layer = Math.floor(this.stageIndex / AREAS_PER_LAYER);
    // Towns stand only in the layers where people still live, and in every
    // endless phase.
    this.map = generateLayerMap(
      this.streams.area(1, Stream.Map, layer),
      layer === 0 ? 1 : 2,
      this.endless || layer < TOWN_LAYERS,
      layer,
    );
    this.path = [];
  }

  /** Whether this run is in endless mode. */
  get isEndless(): boolean {
    return this.endless;
  }

  /** Starts the run about to begin on another seed, as typed or shared. */
  setSeed(seed: string): void {
    const clean = normalizeSeed(seed);
    if (!this.title || clean === '' || clean === this.streams.seed) {
      return;
    }
    this.reset(null, clean);
  }

  /** A link that starts this run's seed, in its mode, for another player. */
  shareLink(): string {
    const seed = encodeURIComponent(this.streams.seed);
    return `${location.origin}${location.pathname}?seed=${seed}${this.endless ? '&endless' : ''}`;
  }

  /** Switches the run about to begin between story and endless, on its seed. */
  setEndless(on: boolean): void {
    if (!this.title || on === this.endless) {
      return;
    }
    this.chosenEndless = on;
    this.reset(null, this.streams.seed);
  }

  // Which layer's ground and monsters the current area has: its own in the
  // story, one rolled for each phase in endless mode.
  private get biome(): number {
    const phase = Math.floor(this.stageIndex / AREAS_PER_LAYER);
    if (!this.endless) {
      return Math.min(phase, LAYERS.length - 1);
    }
    return this.streams.area(1, Stream.Map, ENDLESS_BIOME + phase).int(0, LAYERS.length - 1);
  }

  // Where the party is, for the HUD and the map: the layer, or the phase.
  private get region(): string {
    const phase = Math.floor(this.stageIndex / AREAS_PER_LAYER);
    return this.endless ? `Phase ${phase + 1}` : LAYERS[Math.min(phase, LAYERS.length - 1)].name;
  }

  // Enters an area of the layer's map, by its column and row.
  private goTo(column: number, row: number): void {
    this.node = { column, row };
    this.path.push({ column, row });
    this.stageIndex = Math.floor(this.stageIndex / AREAS_PER_LAYER) * AREAS_PER_LAYER + column;
  }

  // Builds the area the party is in, as the map has it, or as `kind`.
  private buildStage(kind?: MapNode['kind']): Stage {
    const node = this.here();
    const row = this.node?.row ?? 0;
    const area = this.stageIndex + AREA_ROW_STREAM * row;
    this.pendingEvent = null;
    const plan: AreaPlan = {
      kind: kind ?? node?.kind ?? 'combat',
      ahead: this.aheadOf(node),
      aheadFights: this.fightsAhead(node),
      objective: node?.objective && (this.options.objective ?? node.objective),
      biome: this.biome,
      endless: this.endless,
    };
    plan.sides = this.sidesFor(plan.ahead.length, area);
    if (plan.kind === 'event') {
      const rng = this.streams.area(1, Stream.Events, area);
      const forced = this.options.event ? EVENT_BY_ID.get(this.options.event) : undefined;
      const def = forced ?? pickEvent(rng, this.biome, this.eventsSeen);
      this.eventsSeen.add(def.id);
      this.pendingEvent = { def, rng, state: rng.state };
      plan.scene = def.props;
    }
    // Each area of a column lays out from its own stream; the first keeps
    // the stream areas had before the map.
    return generateStage(this.streams.area(1, Stream.Layout, area), this.stageIndex, plan);
  }

  /**
   * Which edge each of an area's exits leaves by, so the way on turns left
   * and right as well as going straight. Exits stay in the map's order:
   * the upper road on the left.
   */
  private sidesFor(count: number, area: number): ExitSide[] {
    const rng = this.streams.area(1, Stream.Map, SIDES_STREAM + area);
    if (count >= 3) {
      return ['north', 'east', 'south'];
    }
    if (count === 2) {
      return rng.pick<ExitSide[]>([
        ['north', 'east'],
        ['east', 'south'],
        ['north', 'south'],
      ]);
    }
    return [rng.pick<ExitSide>(['north', 'east', 'east', 'south'])];
  }

  // Lays out the current stage around the party. An area joined ahead was
  // laid out and filled when it was joined.
  private enter(joined = false): void {
    if (!joined) {
      this.boss = enterStage(this.sim, this.stage);
    }
    if (!this.walked.includes(this.stage)) {
      this.walked.push(this.stage);
    }
    this.objective = this.stage.objective
      ? new ObjectiveRun(this.stage.objective, this.stage)
      : null;
    const here = this.stage;
    this.hazards = here.hazards
      ? new Hazards(here, (h) => {
          // A floor that gave way stays a pit.
          const pit: Prop = { kind: 'pit', x: h.x, z: h.z, r: 1, seed: 0.5 };
          here.props.push(pit);
          this.sim.obstacles.push({ x: pit.x, z: pit.z, r: 1 });
          this.sim.setWorld(this.sim.floor);
        })
      : null;
    const node = this.stage.objective ? this.here() : null;
    this.prize = node?.reward ?? null;
    this.sim.spared = this.prize === 'respite';
    this.bonus =
      this.stage.objective && node?.challenge
        ? new Bonus(node.challenge, this.stage.objective, rectOf(this.stage))
        : null;
    this.bonusMet = null;
    this.mutators.set(node?.mutators ?? []);
    const camp = this.stage.recruit;
    const guild = this.stage.recruits ?? [];
    this.wanderers = guild.map((at, i) => ({ offer: this.starting[i], ...at, met: false }));
    if (camp) {
      this.wanderers.push({
        offer: rollOffer(
          this.streams.area(1, Stream.Recruits, this.stageIndex),
          START_LEVEL + Math.floor(this.stageIndex / 2),
        ),
        ...camp,
        met: false,
      });
    }
    for (const s of this.stage.stains) {
      this.effects.stain(s.x, s.z, s.r, '#560b0b');
    }
    this.beginEvent();
  }

  /** What this area asks of the party, and how far along it is, for the HUD. */
  objectiveStatus(): {
    kind: Objective;
    title: string;
    detail: string;
    done: boolean;
    bonus: BonusStatus | null;
    coming: ComingGroup[];
    mutators: { name: string; text: string }[];
  } | null {
    const o = this.objective;
    if (!o) {
      return null;
    }
    const elite = this.stage.kind === 'elite' ? 'Elite ' : '';
    const title = `${elite}${OBJECTIVE_NAME[o.kind]}`;
    const b = this.bonus;
    let bonus: BonusStatus | null = null;
    if (b) {
      let state: BonusState = b.state;
      let detail = b.status(this.sim);
      if (this.bonusMet !== null) {
        state = this.bonusMet ? 'met' : 'failed';
        detail = this.bonusMet ? `Met. ${BONUS_PAYS[this.prize ?? 'gold']}` : 'Failed.';
      }
      bonus = { title: CHALLENGE_NAME[b.kind], detail, state };
    }
    // A Horde's next wave, by kind, for the badge
    const coming: ComingGroup[] = [];
    for (const kind of o.coming()) {
      const group = coming.find((g) => g.kind === kind);
      if (group) {
        group.count++;
      } else {
        coming.push({ kind, name: MONSTERS[kind].job.name, count: 1 });
      }
    }
    const mutators = (this.here()?.mutators ?? []).map((m) => ({
      name: MUTATOR_NAME[m],
      text: MUTATOR_TEXT[m],
    }));
    return {
      kind: o.kind,
      title,
      detail: o.status(this.sim),
      done: o.done,
      bonus,
      coming,
      mutators,
    };
  }

  // Whether the exits are open: once the objective is done, if there is one,
  // and out of the Guild House once a fighter has been hired.
  private get exitsOpen(): boolean {
    if (this.stage.kind === 'guild') {
      return this.hasFighter;
    }
    return this.objective?.done ?? true;
  }

  // Finishes the objective once its condition is met: the exits open, and
  // its spoils appear before them.
  private checkObjective(): void {
    const o = this.objective;
    if (o && !o.done) {
      this.bonus?.tick(TICK);
    }
    if (!o || !this.bearer.alive || !o.update(this.sim, TICK, monsterLevel(this.stageIndex))) {
      return;
    }
    const better = this.bonus?.met(this.sim) ?? false;
    this.bonusMet = this.bonus ? better : null;
    this.views.snap(this.sim);
    const chest = this.prize ? `the ${REWARD_NAME[this.prize]} chest` : 'the spoils';
    this.say(`${OBJECTIVE_NAME[o.kind]} done. The way on is open, and ${chest} lies before it.`);
    if (this.prize === 'respite') {
      for (const m of this.sim.units) {
        if (m.side === Side.Party && m.alive) {
          m.hp = m.derived.maxHp;
          m.mana = m.derived.maxMana;
        }
      }
      if (better) {
        for (const m of this.mercs()) {
          m.revive(1);
        }
      }
      this.say('A respite: the party is whole again.');
    }
    if (this.bonus) {
      const name = CHALLENGE_NAME[this.bonus.kind];
      this.say(better ? `${name}: met. The reward is better for it.` : `${name}: failed.`);
    }
    const at = this.stage.reward;
    if (at) {
      const holds = this.prize ?? undefined;
      this.stage.props.push({
        kind: 'chest',
        x: at.x,
        z: at.z,
        r: CHEST_SOLID,
        seed: 0.5,
        holds,
        better,
        extra: this.here()?.mutators?.length,
      });
      this.sim.obstacles.push({ x: at.x, z: at.z, r: CHEST_SOLID });
      // The floor stays as it is, with this area and any joined to it.
      this.sim.setWorld(this.sim.floor);
      const loot = this.streams.get(1, Stream.Loot);
      this.scatter([rollGold(loot, 6 + this.stageIndex)], { x: at.x - 1, z: at.z });
    }
  }

  // In a Labyrinth, the bearer picks up the key a slain monster dropped,
  // which opens the hall's gates, and pulls the levers it walks up to.
  private workMaze(): void {
    const b = this.bearer;
    const gates = this.stage.gates;
    if (!b.alive || !gates) {
      return;
    }
    const key = this.stage.props.find(
      (p) => p.kind === 'key' && !p.open && b.distanceTo(p) <= PICK_REACH + 0.4,
    );
    if (key) {
      key.open = true;
      this.stage.props.splice(this.stage.props.indexOf(key), 1);
      this.openGates(gates.filter((g) => !g.lever));
      this.say('The bearer takes the key. The gates of the hall open.');
    }
    for (const g of gates) {
      if (g.lever && !g.open && b.distanceTo(g.lever) <= LEVER_REACH) {
        this.openGates([g]);
        this.say('The bearer pulls the lever. A gate in the maze grinds open.');
      }
    }
  }

  // Opens gates, and takes their bars out of the way.
  private openGates(list: Gate[]): void {
    const gone = list.flatMap((g) => openGate(g));
    if (gone.length === 0) {
      return;
    }
    const obstacles = this.sim.obstacles;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (gone.some((g) => g.x === obstacles[i].x && g.z === obstacles[i].z)) {
        obstacles.splice(i, 1);
      }
    }
    this.sim.setWorld(this.sim.floor);
  }

  // Monsters awake are seen, for the compendium.
  private noteMonsters(): void {
    for (const m of this.sim.units) {
      if (m.side === Side.Monster && m.aware && m.alive) {
        this.compendium.see(m.kind);
      }
    }
  }

  // Rolls what waits at this area's Event, if it has one.
  private beginEvent(): void {
    const pending = this.pendingEvent;
    const at = this.stage.event;
    this.encounter = null;
    this.pendingEvent = null;
    if (!pending || !at) {
      return;
    }
    const play = pending.def.begin({
      rng: pending.rng,
      sim: this.sim,
      pack: this.pack,
      level: monsterLevel(this.stageIndex),
      mercLevel: START_LEVEL + Math.floor(this.stageIndex / 2),
      at,
      give: (items) => {
        this.scatter(items, { x: at.x + 1, z: at.z });
      },
      cannotHire: (wage) => {
        if (this.mercs().length >= PARTY_SIZE) {
          return `The party is full: ${PARTY_SIZE} mercs at most.`;
        }
        return this.pack.gold < wage ? `It costs ${wage} gold. You have ${this.pack.gold}.` : null;
      },
      hire: (offer, wage) => {
        this.pack.gold -= wage;
        this.join(offer, at.x + 1, at.z);
      },
    });
    this.encounter = {
      def: pending.def,
      play,
      at,
      outcome: null,
      met: false,
      state: pending.state,
    };
  }

  // Who stands in the area out of the fight: recruits for hire, and
  // whoever waits at the Event until a choice is made, or lies dead there.
  private figures(): Frame['figures'] {
    const out: Frame['figures'] = this.wanderers.map((w) => ({
      kind: w.offer.kind,
      x: w.x,
      z: w.z,
      label: `${w.offer.name}, ${MERCS[w.offer.kind].job.name}`,
      fallen: false,
    }));
    const e = this.encounter;
    const kind = e?.play.figure;
    if (e && kind && (e.outcome === null || e.play.fallen)) {
      out.push({
        kind,
        x: e.at.x,
        z: e.at.z,
        label: e.outcome === null ? e.def.title : null,
        fallen: e.play.fallen ?? false,
      });
    }
    return out;
  }

  // The Event as the interface shows it.
  private eventView(): EventView | null {
    const e = this.encounter;
    return e
      ? {
          title: e.def.title,
          text: e.play.text,
          choices: e.play.choices.map((c) => ({ label: c.label, why: c.why?.() ?? null })),
          outcome: e.outcome,
        }
      : null;
  }

  // Opens the Event when the bearer walks up to it, until a choice is made.
  private visitEvent(): void {
    const e = this.encounter;
    if (e?.outcome !== null || this.eventOpen) {
      return;
    }
    const d = Math.hypot(this.bearer.x - e.at.x, this.bearer.z - e.at.z);
    if (d > LEAVE_REACH) {
      e.met = false;
    } else if (d <= MEET_REACH && !e.met && this.bearer.alive) {
      e.met = true;
      this.eventOpen = true;
      this.keys.clear();
      this.bearer.order = null;
      this.hooks.onEvent?.(this.eventView());
    }
  }

  /** Makes one of the Event's choices. Returns why it could not, or null. */
  chooseEvent(index: number): string | null {
    const e = this.encounter;
    const choice = e?.play.choices[index];
    if (!e || !choice || e.outcome !== null) {
      return null;
    }
    const why = choice.why?.() ?? null;
    if (why) {
      return why;
    }
    e.outcome = choice.pick();
    this.views.snap(this.sim);
    this.itemsChanged();
    this.hooks.onEvent?.(this.eventView());
    return null;
  }

  /** Closes the Event. Before a choice is made, walking back opens it again. */
  closeEvent(): void {
    this.eventOpen = false;
    this.hooks.onEvent?.(null);
  }

  // The party sets out by an exit. A road on joins the next area beyond it,
  // to walk into. The way down to the next layer is taken at once.
  private leave(exit: number): void {
    // Mercs whose morale broke stay behind.
    const gone = desert(this.sim);
    if (gone.length > 0) {
      this.say(`${names(gone)} ${gone.length > 1 ? 'desert' : 'deserts'} the party.`);
      this.hooks.onChange?.();
    }
    if (this.stage.exits[exit]?.ahead === 'down') {
      this.descend(exit);
    } else {
      this.joinArea(exit);
    }
  }

  // Joins the area beyond an exit to the world: the other roads collapse,
  // and the bearer walks on into it.
  private joinArea(exit: number): void {
    const way = this.stage.exits[exit];
    if (this.stage.kind === 'guild') {
      // From the Guild House, the road leads into the first phase.
      this.goTo(0, exit);
    } else if (this.stage.station) {
      // The unpaid lose heart as the party takes the road on.
      const unpaid = this.payroll?.settle(this.sim) ?? [];
      if (unpaid.length > 0) {
        this.say(`${names(unpaid)} ${unpaid.length > 1 ? 'go' : 'goes'} on unpaid, and sullen.`);
      }
      this.payroll = null;
      this.goTo(0, exit);
    } else {
      const node = this.here();
      this.goTo((this.node?.column ?? -1) + 1, node?.next[exit] ?? 0);
    }
    // Anything still behind is gone first: only two areas stand at once.
    this.collapse();
    const next = placeBeyond(this.buildStage(), way);
    way.taken = true;
    this.stage.exits.forEach((e, k) => {
      if (k !== exit) {
        e.closed = true;
        this.blockRoad(e);
      }
    });
    this.seam(next, way);
    const boss = joinStage(this.sim, next, [rectOf(this.stage), rectOf(next)]);
    this.ahead = { stage: next, boss };
    // On into it, a few steps past its entrance
    this.bearer.order = {
      x: next.entrance.x + way.out.x * 2,
      z: next.entrance.z + way.out.z * 2,
    };
    this.goFor();
    this.views.snap(this.sim);
  }

  // A road not taken falls in: rubble across it, where its exit was.
  private blockRoad(e: Exit): void {
    const across = { x: -e.out.z, z: e.out.x };
    for (const k of [-1.2, 0, 1.2]) {
      const x = e.x + across.x * k;
      const z = e.z + across.z * k;
      this.stage.props.push({ kind: 'rubble', x, z, r: 0.6, seed: 0.3 + k * 0.1 });
      this.sim.obstacles.push({ x, z, r: 0.6 });
    }
  }

  // Rubble along the edge where two areas meet, but for the road across.
  private seam(next: Stage, way: Exit): void {
    const a = rectOf(this.stage);
    const b = rectOf(next);
    const along = way.out.x !== 0;
    // The edge's line, and the stretch both areas share
    let line = way.out.z > 0 ? a.z1 : a.z0;
    if (along) {
      line = way.out.x > 0 ? a.x1 : a.x0;
    }
    const from = along ? Math.max(a.z0, b.z0) : Math.max(a.x0, b.x0);
    const to = along ? Math.min(a.z1, b.z1) : Math.min(a.x1, b.x1);
    const road = along ? way.z : way.x;
    for (let t = from + 0.5; t < to; t += 0.9) {
      if (Math.abs(t - road) < 2.5) {
        continue;
      }
      const x = along ? line : t;
      const z = along ? t : line;
      next.props.push({ kind: 'rubble', x, z, r: 0.45, seed: (t * 7.3) % 1 });
    }
  }

  // The bearer has crossed into the area ahead: it becomes the area the
  // party is in, and the one behind waits to collapse.
  private cross(): void {
    const ahead = this.ahead;
    if (!ahead) {
      return;
    }
    this.behind = { stage: this.stage, t: 0 };
    this.stage = ahead.stage;
    this.boss = ahead.boss;
    this.ahead = null;
    this.sim.area++;
    this.rested = false;
    this.hoverExit = null;
    this.enter(true);
    this.persist();
  }

  // Waits for the party to follow the bearer out of the area behind, then
  // lets it collapse.
  private settleBehind(): void {
    const behind = this.behind;
    if (!behind) {
      return;
    }
    behind.t += TICK;
    const r = rectOf(behind.stage);
    const here = rectOf(this.stage);
    const lagging = this.sim.living(Side.Party).some((u) => inRect(r, u) && !inRect(here, u));
    if (!lagging || behind.t >= COLLAPSE_WAIT) {
      this.collapse();
    }
  }

  // The area behind collapses: what is in it is lost, and the party's own
  // still in it are brought to the entrance of the area they are in.
  private collapse(): void {
    const behind = this.behind;
    if (!behind) {
      return;
    }
    this.behind = null;
    dropStage(
      this.sim,
      behind.stage,
      [this.stage, ...(this.ahead ? [this.ahead.stage] : [])],
      this.stage.entrance,
    );
    const r = rectOf(behind.stage);
    this.ground = this.ground.filter((g) => !inRect(r, g) || inRect(rectOf(this.stage), g));
    this.fading = { stage: behind.stage, t: 0 };
  }

  // The bearer took the way down: down to the next layer's Waystation, or
  // the tomb. Party and all, and nothing else.
  private descend(exit: number): void {
    if (
      this.stage.exits[exit]?.ahead === 'down' &&
      !this.endless &&
      layerIndexOf(this.stageIndex) === LAYERS.length - 1
    ) {
      // Below the Sunken Crown lies only the tomb.
      this.stageIndex++;
      this.node = null;
      this.stage = generateTomb(this.streams.area(1, Stream.Layout, TOMB_STREAM), this.stageIndex);
    } else {
      this.stageIndex++;
      this.rollMap();
      this.node = null;
      this.stage = this.buildWaystation();
    }
    this.ahead = null;
    this.behind = null;
    this.fading = null;
    this.rested = false;
    // A new layer, a new map.
    this.walked = [];
    this.renderer.forgetAreas([]);
    carryParty(this.sim, this.stage);
    this.effects.clear();
    // What was left on the old stage's floor is lost.
    this.ground = [];
    this.goFor();
    this.hoverExit = null;
    this.views.snap(this.sim);
    this.renderer.snapCamera();
    this.enter();
    this.persist();
  }

  // The Waystation before the current area, with this layer's wages owed.
  private buildWaystation(): Stage {
    this.payroll = new Payroll();
    this.stationMet = false;
    return withFightsAhead(
      generateWaystation(
        this.streams.area(1, Stream.Layout, WAYSTATION_STREAM + this.stageIndex),
        this.stageIndex,
        this.aheadOf(null),
        this.biome,
        this.sidesFor(this.aheadOf(null).length, WAYSTATION_STREAM + this.stageIndex),
      ),
      this.fightsAhead(null),
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
    title: string;
  } {
    return {
      map: this.map,
      path: [...this.path],
      at: this.node,
      layer: Math.floor(this.stageIndex / AREAS_PER_LAYER),
      title: this.region,
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
      this.endRun(f.ending);
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
      if (this.eventOpen) {
        this.closeEvent();
      }
      if (this.compendiumOpen) {
        this.openCompendium(false);
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
    if (key === 'm' && !this.over && !this.title) {
      this.openMap(!this.mapOpen);
      return;
    }
    if (key === 'k') {
      this.openCompendium(!this.compendiumOpen);
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
    // What a click would do shows in the cursor and the exit's plate.
    const free = !this.paused && !this.over && !this.finale;
    this.hoverExit = free ? this.exitAt(e.clientX, e.clientY) : null;
    const clickable =
      free &&
      (this.hoverExit !== null ||
        this.recruitAt(e.clientX, e.clientY) !== null ||
        this.chestAt(e.clientX, e.clientY) !== null ||
        this.renderer.labelAt(e.clientX, e.clientY) !== null);
    this.canvas.style.cursor = clickable ? 'pointer' : '';
  };

  // The exit whose plate is under a point on the screen, if any.
  private exitAt(clientX: number, clientY: number): number | null {
    const p = this.renderer.unproject(clientX, clientY);
    const i = this.stage.exits.findIndex(
      (e) =>
        e.taken !== true &&
        e.closed !== true &&
        Math.max(Math.abs(p.x - e.x), Math.abs(p.z - e.z)) <= EXIT_PLATE,
    );
    return i >= 0 && this.renderer.known(this.stage.exits[i].x, this.stage.exits[i].z) ? i : null;
  }

  // The closed chest under a point on the screen, if any.
  private chestAt(clientX: number, clientY: number): Prop | null {
    const p = this.renderer.unproject(clientX, clientY);
    return (
      this.stage.props.find(
        (c) => c.kind === 'chest' && !c.open && Math.hypot(c.x - p.x, c.z - p.z) <= CHEST_PICK,
      ) ?? null
    );
  }

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
      this.goFor({ fetching: labelled });
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
      this.goFor({ fetching: item });
      this.bearer.order = { x: item.x, z: item.z };
      return;
    }
    // Clicking a recruit walks the bearer over to talk to it.
    const recruit = this.recruitAt(e.clientX, e.clientY);
    if (recruit) {
      this.goFor({ seeking: recruit });
      this.bearer.order = { x: recruit.x - 0.8, z: recruit.z + 0.4 };
      return;
    }
    // Clicking an exit's plate walks the bearer to it, to leave by it.
    const exit = this.exitAt(e.clientX, e.clientY);
    if (exit !== null) {
      const e2 = this.stage.exits[exit];
      if (e2.ahead === 'down' && this.boss?.alive) {
        this.say(`The way down is shut while ${this.boss.name} lives.`);
        return;
      }
      const o = this.objective;
      if (o && !o.done) {
        this.say(`The way on opens once the ${OBJECTIVE_NAME[o.kind]} is done.`);
        return;
      }
      if (this.stage.kind === 'guild' && !this.hasFighter) {
        this.say('The Guild sends no Writ out without a sword: hire a Vanguard or a Ranger.');
        return;
      }
      this.goFor({ leaving: exit });
      this.bearer.order = { x: e2.x, z: e2.z };
      return;
    }
    // Clicking a chest walks the bearer to it, to open it.
    const chest = this.chestAt(e.clientX, e.clientY);
    if (chest) {
      this.goFor({ opening: chest });
      this.bearer.order = { x: chest.x - 0.6, z: chest.z };
      return;
    }
    this.goFor({});
    const spot = this.renderer.unproject(e.clientX, e.clientY);
    this.bearer.order = this.sim.clamp(spot);
  };

  // What the bearer is walking over to do, replacing whatever it was before.
  private goFor(
    aim: {
      fetching?: GroundItem;
      opening?: Prop;
      leaving?: number;
      seeking?: Game['seeking'];
    } = {},
  ): void {
    this.fetching = aim.fetching ?? null;
    this.opening = aim.opening ?? null;
    this.leaving = aim.leaving ?? null;
    this.seeking = aim.seeking ?? null;
  }

  // The recruit drawn under a point on the screen, if any.
  private recruitAt(clientX: number, clientY: number): Game['seeking'] {
    const s = this.renderer.toSmall(clientX, clientY);
    const z = look.zoom;
    return (
      this.wanderers.find((w) => {
        const b = this.renderer.iso(w.x, w.z);
        return Math.abs(s.x - b.x) <= 9 * z && s.y >= b.y - 38 * z && s.y <= b.y + 6 * z;
      }) ?? null
    );
  }

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
    this.goFor();
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
        this.visitEvent();
        this.workMaze();
        this.noteMonsters();
        this.hazards?.update(this.sim, TICK);
        this.mutators.update(TICK);
        this.checkObjective();
        this.acc -= TICK;
        if (wakeBoss(this.sim, this.boss)) {
          // The boss rises to meet the party.
          this.shake = Math.max(this.shake, 4);
          this.say(`${this.boss?.name ?? 'Something'} rises. There is no way back.`);
        }
        this.rest();
        this.breakSeal();
        this.endFinale();
        // The way down opens only once the boss is dead.
        // The bearer leaves only by the exit it was sent to.
        const exit = this.stage.exits.findIndex(
          (e, i) =>
            i === this.leaving &&
            this.exitsOpen &&
            this.bearer.distanceTo(e) <= EXIT_REACH &&
            !(e.ahead === 'down' && this.boss?.alive),
        );
        if (this.bearer.alive && exit >= 0 && this.stage.exits[exit].taken !== true) {
          this.leave(exit);
          this.acc = 0;
        }
        if (
          this.ahead &&
          this.bearer.alive &&
          inRect(inner(rectOf(this.ahead.stage)), this.bearer)
        ) {
          this.cross();
        }
        this.settleBehind();
        if (this.fading) {
          this.fading.t += TICK;
          if (this.fading.t >= COLLAPSE_FADE) {
            this.fading = null;
          }
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
      areas: [
        { stage: this.stage, alpha: 1 },
        ...(this.ahead ? [{ stage: this.ahead.stage, alpha: 1 }] : []),
        ...(this.behind ? [{ stage: this.behind.stage, alpha: 1 }] : []),
        ...(this.fading
          ? [{ stage: this.fading.stage, alpha: 1 - this.fading.t / COLLAPSE_FADE }]
          : []),
      ],
      views: this.views,
      effects: this.effects,
      alpha,
      time: this.time,
      slain: this.slain,
      ground: this.ground,
      figures: this.figures(),
      over: this.over,
      ending: this.finale?.ending ?? null,
      region: this.region,
      hoverExit: this.hoverExit,
      exitsShut: !this.exitsOpen,
      dark: this.mutators.has('darkness'),
      leaving: this.leaving,
      seed: this.streams.seed,
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
    // Each recruit waiting to be hired, as shares of the canvas.
    this.canvas.dataset.recruits = this.wanderers
      .map((w) => {
        const p = this.renderer.shareOnScreen(w.x, w.z);
        return `${w.offer.name}/${w.offer.kind}:${p.x.toFixed(4)},${p.y.toFixed(4)}`;
      })
      .join(';');
    // Each exit's plate, north first, as shares of the canvas, so tests can click them.
    this.canvas.dataset.exits = this.stage.exits
      .map((e) => {
        const p = this.renderer.shareOnScreen(e.x, e.z);
        return `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
      })
      .join(';');
    // Each merc's feet, as shares of the canvas, so tests can click them.
    this.canvas.dataset.mercs = this.mercs()
      .map((m) => {
        const p = this.renderer.shareOnScreen(m.x, m.z);
        return `${m.name}:${p.x.toFixed(4)},${p.y.toFixed(4)}`;
      })
      .join(';');
  }
}

// Materials as a reader would list them, such as "2 Iron and 1 Bone".
function materialList(found: Materials): string {
  const parts = [...found].map(([id, n]) => `${n} ${MATERIAL_NAME.get(id) ?? id}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join('');
}

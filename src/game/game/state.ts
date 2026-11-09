import { type RunStreams, Stream } from '../../core/seed';
import type { Item } from '../../sim/item';
import type Sim from '../../sim/sim';
import { Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import type { Effects } from '../../render/effects';
import Renderer from '../../render/renderer';
import type { Views } from '../../render/view';
import type { Prop, Stage } from '../../gen/stage';
import type { LayerMap, Reward } from '../../gen/graph';
import type { MiniBossId } from '../../content/minibosses';
import { Floods } from '../../content/minibosses';
import type { EventDef, EventPlay } from '../../content/events';
import type RNG from '../../core/rng';
import { FIGHTERS, type Offer, wageFor } from '../../content/recruits';
import { applySets } from '../../content/sets';
import { type GroundItem, Pack, Vault } from '../inventory';
import type { Payroll } from '../wages';
import { Compendium } from '../compendium';
import type ObjectiveRun from '../objective';
import Alarms from '../alarms';
import Captains from '../captains';
import Footing from '../footing';
import type Hazards from '../hazards';
import type Bonus from '../bonus';
import type MutatorRun from '../mutators';
import type Director from '../director';
import type Flow from '../../sim/flow';
import { START_LEVEL } from '../stage';
import type { UpgradeOffer } from '../mastery';
import type { GameHooks, GameOptions } from './types';

// The most mercs in the party, living or dead.
export const PARTY_SIZE = 4;

/**
 * The Guild's purse at the start of a run: enough to hire three more mercs
 * of the first stages' levels by the fires, unless they are greedy.
 */
export const START_GOLD = 3 * wageFor(START_LEVEL + 1);
// The bearer meets a wandering merc from this close, and leaves it from this far.
export const MEET_REACH = 1.8;
export const LEAVE_REACH = 4;
// Seconds a notice stays on screen
const NOTICE_TIME = 6;

/** A merc waiting to be hired, by its fire or at the Guild House. */
export interface Wanderer {
  offer: Offer;
  x: number;
  z: number;
  met: boolean;
}

/**
 * Everything a run holds between frames. `Game` keeps one and hands it to
 * the feature modules in this folder, which read and change it.
 */
export default class GameState {
  readonly renderer: Renderer;
  readonly keys = new Set<string>();
  sim!: Sim;
  stage!: Stage;
  views!: Views;
  effects!: Effects;
  bearer!: Unit;
  streams!: RunStreams;
  time = 0;
  acc = 0;
  slain = 0;
  over = false;
  // Which stage of the run the party is on, from 0
  stageIndex = 0;
  frameId = 0;
  last = 0;
  selected: Unit | null = null;
  inventory = false;
  gearMerc: Unit | null = null;
  // What the bearer carries, and what lies on the floor
  pack = new Pack();
  ground: GroundItem[] = [];
  // The item the bearer is walking over to pick up, the chest it is
  // walking to open and the exit it is walking to leave by. Each is done
  // only once clicked, so walking past never opens or leaves by accident.
  fetching: GroundItem | null = null;
  opening: Prop | null = null;
  leaving: number | null = null;
  seeking: Wanderer | null = null;
  // The exit under the mouse, drawn brighter
  hoverExit: number | null = null;
  // What this area asks before its exits open, and whether it is done
  objective: ObjectiveRun | null = null;
  // The area joined beyond the exit the party took, with its boss, before
  // the party crosses into it; and the area behind, until it collapses, and
  // its floor as it fades
  ahead: { stage: Stage; boss: Unit | null } | null = null;
  behind: { stage: Stage; t: number } | null = null;
  fading: { stage: Stage; t: number } | null = null;
  // A Labyrinth's traps, and whether the bearer was hurt in this area
  hazards: Hazards | null = null;
  readonly footing = new Footing();
  readonly captains = new Captains();
  // What this fight's chest holds once its objective is done, its bonus
  // challenge, and whether that was met once the objective was done
  prize: Reward | null = null;
  bonus: Bonus | null = null;
  bonusMet: boolean | null = null;
  // The rules this fight's mutators change
  mutators!: MutatorRun;
  director!: Director;
  // The mini-bosses met so far in the run, each only once
  readonly metMiniBosses = new Set<MiniBossId>();
  // The Drowned Cantor's floods
  readonly floods = new Floods();
  readonly alarms = new Alarms();
  // Mini-bosses already named in the log
  readonly announced = new WeakSet<Unit>();
  // The current area's flow, from its entrance, for the director
  flow: Flow | null = null;
  // Whether the title panel is up, before the run begins
  title = false;
  // The recruits rolled for the Guild House at the start of the run
  starting: Offer[] = [];
  // A merc waiting by its fire on this stage, and the one being talked to
  wanderers: Wanderer[] = [];
  // The boss of a layer's last area, while the party is in it
  boss: Unit | null = null;
  // The party's storage for the run, and the wages owed at this Waystation
  readonly vault = new Vault();
  payroll: Payroll | null = null;
  stationOpen = false;
  // Elite upgrade offers waiting to be picked, the first open; and the layer
  // whose Waystation has drawn its own (-1 if none yet)
  offers: UpgradeOffer[] = [];
  offeredAt = -1;
  stationMet = false;
  townOpen = false;
  townMet = false;
  // The Event of this area, as it plays out, and the ones met on this run
  encounter: {
    def: EventDef;
    play: EventPlay;
    at: { x: number; z: number };
    outcome: string | null;
    met: boolean;
    // Its stream as it stood before it began, for the save
    state: number;
  } | null = null;
  pendingEvent: { def: EventDef; rng: RNG; state: number } | null = null;
  eventOpen = false;
  readonly eventsSeen = new Set<string>();
  // What the player has found over every run, and whether it is open
  readonly compendium: Compendium;
  compendiumOpen = false;
  // Endless mode: phases without end, each on a biome rolled from every
  // layer's, recruits in all of them, no Writ and no Creditor
  endless = false;
  chosenEndless: boolean;
  // A line shown under the hint for a while, such as who left unpaid
  notice: { text: string; until: number } | null = null;
  // This layer's map, the area the party is in (null at a Waystation) and
  // the areas it has crossed
  map: LayerMap = { columns: [], start: { x: 0, y: 0 } };
  node: { column: number; row: number } | null = null;
  path: { column: number; row: number }[] = [];
  mapOpen = false;
  // Whether the party has rested at this area's Camp
  rested = false;
  // Where the mouse is over the canvas, for Focus, and the bearer's last
  // shout as it shows over its head
  pointer: { x: number; y: number } | null = null;
  // Mercs that died over the run: souls fed to the Creditor
  souls = 0;
  // The end of the run: the Creditor, once the seal breaks, and how it ended
  finale: { creditor: Unit; ending: 'sealed' | 'risen' | null } | null = null;
  callout: { text: string; until: number } | null = null;
  recruiting: Wanderer | null = null;
  // Impact: a short freeze on heavy hits, and screen shake in pixels.
  hitStop = 0;
  shake = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly hooks: GameHooks,
    readonly options: GameOptions,
  ) {
    this.renderer = new Renderer(canvas);
    this.compendium = new Compendium(this.saving);
    this.chosenEndless = options.endless ?? false;
  }

  /** The game pauses while a merc's orders are open. */
  get paused(): boolean {
    return (
      this.selected !== null ||
      this.inventory ||
      this.title ||
      this.recruiting !== null ||
      this.stationOpen ||
      this.offers.length > 0 ||
      this.mapOpen ||
      this.townOpen ||
      this.eventOpen ||
      this.compendiumOpen
    );
  }

  // A run begins at the Guild House, unless started at a chosen place or
  // with a party, as tests and playtesting do.
  get startsAtGuild(): boolean {
    return this.saving && !this.options.party;
  }

  // Whether this run keeps a save: not one started at a chosen place, as
  // tests and playtesting do, so they never touch the player's run.
  get saving(): boolean {
    const o = this.options;
    const placed = [o.party, o.area, o.event, o.objective].some((v) => v !== undefined);
    return !placed && !o.station && !o.tomb && !o.town;
  }

  // Whether the party has a merc that can kill what attacks the bearer.
  get hasFighter(): boolean {
    return this.mercs().some((m) => m.alive && (FIGHTERS as readonly string[]).includes(m.kind));
  }

  // What a recruit asks to join: nothing for the first, which the Guild pays.
  priceOf(offer: Offer): number {
    return this.stage.kind === 'guild' && this.mercs().length === 0 ? 0 : offer.wage;
  }

  say(text: string): void {
    this.notice = { text, until: this.time + NOTICE_TIME };
  }

  itemsChanged(): void {
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
    return [...this.sim.units].filter(
      (u) => u.side === Side.Party && u !== this.bearer && !u.statuses.has('turned'),
    );
  }

  select(unit: Unit | null): void {
    this.selected = unit;
    // Held keys would walk the bearer the moment the game resumes.
    this.keys.clear();
    this.hooks.onSelect?.(unit);
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

  // Throws items onto the floor around a spot, as a monster falls or a chest opens.
  scatter(items: Item[], at: { x: number; z: number }): void {
    const rng = this.streams.get(1, Stream.Loot);
    for (const item of items) {
      this.compendium.seeDrop(item);
      const a = rng.random() * Math.PI * 2;
      const r = rng.range(0.3, 0.9);
      this.ground.push({ item, x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r });
    }
  }

  // What the bearer is walking over to do, replacing whatever it was before.
  goFor(
    aim: {
      fetching?: GroundItem;
      opening?: Prop;
      leaving?: number;
      seeking?: Wanderer | null;
    } = {},
  ): void {
    this.fetching = aim.fetching ?? null;
    this.opening = aim.opening ?? null;
    this.leaving = aim.leaving ?? null;
    this.seeking = aim.seeking ?? null;
  }
}

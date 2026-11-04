import type Unit from '../sim/unit';
import { type EquipSlot, type Item, isCard, isPotion } from '../sim/item';
import type { Shout } from '../sim/shout';
import type { Recipe } from '../content/recipes';
import type { LayerMap, Objective } from '../gen/graph';
import { beltToPack, equipFromPack, packToBelt, socketCard, unequipToPack } from './inventory';
import type { Pack, Vault } from './inventory';
import type { Due } from './wages';
import type { Compendium } from './compendium';
import type { AreaScore, Phase } from './director';
import type { RunSave } from './save';
import type { UpgradeOffer } from './mastery';
import GameState from './game/state';
import type { BonusStatus, ComingGroup, GameHooks, GameOptions } from './game/types';
import * as run from './game/run';
import * as saving from './game/saving';
import * as route from './game/route';
import * as fight from './game/fight';
import * as recruits from './game/recruits';
import * as encounter from './game/encounter';
import * as station from './game/station';
import * as smith from './game/smith';
import * as shouts from './game/shouts';
import * as input from './game/input';
import * as pickups from './game/pickups';
import { MAX_FRAME, advance } from './game/tick';
import render from './game/render';

// The game's features live in `./game/`, one module each, and work on the
// run's state in `./game/state.ts`. This class is the face the interface
// talks to: it owns the state, the browser listeners and the frame loop,
// and hands every call to the module that does it.
export type { BonusStatus, ComingGroup, EventView, GameHooks, GameOptions } from './game/types';
export { PARTY_SIZE, START_GOLD } from './game/state';
export { sidesToward } from './game/route';

/**
 * One playable stage: the simulation at a fixed 20 ticks per second, drawn
 * every frame between ticks.
 */
export default class Game {
  // Everything the run holds, which the feature modules read and change
  private readonly s: GameState;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    hooks: GameHooks = {},
    options: GameOptions = {},
  ) {
    this.s = new GameState(canvas, hooks, options);
    this.reset();
  }

  /** What the bearer carries. */
  get pack(): Pack {
    return this.s.pack;
  }

  set pack(pack: Pack) {
    this.s.pack = pack;
  }

  /** The party's storage for the run. */
  get vault(): Vault {
    return this.s.vault;
  }

  /** What the player has found over every run. */
  get compendium(): Compendium {
    return this.s.compendium;
  }

  /** The game pauses while a merc's orders are open. */
  get paused(): boolean {
    return this.s.paused;
  }

  /** The run's seed, to show and to share. */
  get seed(): string {
    return this.s.streams.seed;
  }

  /** Closes the title panel: the bearer stands in the Guild House. */
  setOut(): void {
    this.s.title = false;
    this.s.hooks.onTitle?.(false, this.s.streams.seed);
  }

  /** Resumes a saved run at the entrance of the area it was saved in. */
  resume(save: RunSave): void {
    this.reset(save);
  }

  /** Opens or closes the compendium. The game pauses while it is open. */
  openCompendium(open: boolean): void {
    this.s.compendiumOpen = open;
    this.s.keys.clear();
    this.s.hooks.onCompendium?.(open);
  }

  /** The run as it stands, for the save. Taken on entering an area. */
  snapshot(): RunSave {
    return saving.snapshot(this.s);
  }

  /** Hires the merc being talked to. Returns why it failed, or null. */
  hire(): string | null {
    return recruits.hire(this.s);
  }

  /** Leaves the wandering merc where it is. Walking back to it asks again. */
  endTalk(): void {
    recruits.endTalk(this.s);
  }

  /** Whether the merc being talked to waits at the Guild House, and not by a fire. */
  get atGuild(): boolean {
    return this.s.stage.kind === 'guild';
  }

  /**
   * Opens or closes the inventory. The game pauses while it is open. A merc
   * passed in is the one it opens on, to hand gear to.
   */
  openInventory(open: boolean, merc: Unit | null = null): void {
    this.s.openInventory(open, merc);
  }

  /** The merc the inventory was opened for, if any. */
  get gearFor(): Unit | null {
    return this.s.gearMerc;
  }

  get inventoryOpen(): boolean {
    return this.s.inventory;
  }

  /** Hands an item from the pack to a merc. Returns why it failed, or null. */
  equip(merc: Unit, uid: number): string | null {
    const s = this.s;
    const item = s.pack.items.find((i) => i.uid === uid);
    // Potions go on the belt, cards and gems into a socket, the rest is worn.
    let error: string | null;
    if (item && isPotion(item)) {
      error = packToBelt(s.sim, s.bearer, s.pack, merc, uid);
    } else if (item && isCard(item)) {
      error = socketCard(s.sim, s.bearer, s.pack, merc, uid);
    } else {
      error = equipFromPack(s.sim, s.bearer, s.pack, merc, uid);
    }
    s.itemsChanged();
    return error;
  }

  /** Takes an item off a merc into the pack. Returns why it failed, or null. */
  unequip(merc: Unit, slot: EquipSlot): string | null {
    const error = unequipToPack(this.s.sim, this.s.bearer, this.s.pack, merc, slot);
    this.s.itemsChanged();
    return error;
  }

  /** Takes a belt slot's potions back into the pack. Returns why it failed, or null. */
  unbelt(merc: Unit, slot: number): string | null {
    const error = beltToPack(this.s.sim, this.s.bearer, this.s.pack, merc, slot);
    this.s.itemsChanged();
    return error;
  }

  /** The bearer drinks a healing potion from the pack. */
  drinkHealing(): void {
    const potion = this.s.pack.healingPotion();
    if (potion && this.s.bearer.drink(potion)) {
      this.s.pack.tidy();
      this.s.itemsChanged();
    }
  }

  /** Drops an item from the pack at the bearer's feet. */
  drop(uid: number): void {
    pickups.drop(this.s, uid);
  }

  /** The mercs, alive or dead, in the order they joined. */
  mercs(): Unit[] {
    return this.s.mercs();
  }

  select(unit: Unit | null): void {
    this.s.select(unit);
  }

  /** Starts a new run, or resumes a saved one at its area's entrance. */
  reset(save: RunSave | null = null, seed = this.s.options.seed): void {
    run.reset(this.s, save, seed);
  }

  /** Tells the interface the party changed, after a skill or stat was spent. */
  changed(): void {
    this.s.hooks.onChange?.();
  }

  /** Whether this run is in endless mode. */
  get isEndless(): boolean {
    return this.s.endless;
  }

  /** Starts the run about to begin on another seed, as typed or shared. */
  setSeed(seed: string): void {
    run.setSeed(this.s, seed);
  }

  /** A link that starts this run's seed, in its mode, for another player. */
  shareLink(): string {
    return run.shareLink(this.s);
  }

  /** Switches the run about to begin between story and endless, on its seed. */
  setEndless(on: boolean): void {
    run.setEndless(this.s, on);
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
    return fight.objectiveStatus(this.s);
  }

  /** What the level director is reading, for its debug overlay. */
  directorStatus(): {
    phase: Phase;
    phaseName: string;
    left: number | null;
    pacing: number;
    standing: number;
    progress: number;
    scale: number;
    spots: { spawn: number; boss: number; relief: number };
    bosses: readonly string[];
    intensity: { name: string; value: number }[];
    last: AreaScore | null;
  } {
    return fight.directorStatus(this.s);
  }

  /** Makes one of the Event's choices. Returns why it could not, or null. */
  chooseEvent(index: number): string | null {
    return encounter.chooseEvent(this.s, index);
  }

  /** Closes the Event. Before a choice is made, walking back opens it again. */
  closeEvent(): void {
    encounter.closeEvent(this.s);
  }

  /** Opens or closes the layer's map. The game pauses while it is open. */
  openMap(open: boolean): void {
    this.s.mapOpen = open;
    this.s.keys.clear();
    this.s.hooks.onMap?.(open);
  }

  /** This layer's map, the areas crossed, and where the party is now. */
  layerMap(): {
    map: LayerMap;
    path: { column: number; row: number }[];
    at: { column: number; row: number } | null;
    layer: number;
    title: string;
  } {
    return route.layerMap(this.s);
  }

  /** Closes the Town's panel. Walking back to the well opens it again. */
  closeTown(): void {
    station.closeTown(this.s);
  }

  /** Every item the smith can work on: the pack's, then what each merc wears. */
  smithable(): { item: Item; merc: Unit | null }[] {
    return smith.smithable(this.s);
  }

  /** The smith refines an item one level. Returns what happened. */
  refineItem(item: Item, bless: boolean): string {
    return smith.refineItem(this.s, item, bless);
  }

  /** The smith adds a socket. Returns what happened. */
  socketItem(item: Item): string {
    return smith.socketItem(this.s, item);
  }

  /** The bench makes a recipe. Returns why it could not, or null. */
  craft(recipe: Recipe): string | null {
    return smith.craft(this.s, recipe);
  }

  /** The bench breaks a pack item down into materials. */
  salvage(uid: number): string | null {
    return smith.salvage(this.s, uid);
  }

  /** The Temple raises a dead merc. */
  raise(merc: Unit): string | null {
    return smith.raise(this.s, merc);
  }

  /** The Market sells a potion. */
  buy(id: string): string | null {
    return smith.buy(this.s, id);
  }

  /** The Market buys a pack item. */
  sell(uid: number): string | null {
    return smith.sell(this.s, uid);
  }

  /** The elite upgrade offer open now, which pauses the game until a card is taken. */
  get offer(): UpgradeOffer | null {
    return this.s.offers[0] ?? null;
  }

  /** The party's mercs, the bearer left out: whom an offer's cards are for. */
  mercsOf(): Unit[] {
    return this.s.mercs();
  }

  /** Takes card `i` of the open offer. Returns why it failed, or null. */
  pickCard(i: number): string | null {
    return station.pickCard(this.s, i);
  }

  /** Closes the Waystation's post. Walking back to it opens it again. */
  closeStation(): void {
    station.closeStation(this.s);
  }

  /** The wages owed at this Waystation, or none elsewhere. */
  dues(): Due[] {
    return station.dues(this.s);
  }

  /** Pays one merc's wage. Returns why it could not, or null. */
  pay(merc: Unit): string | null {
    return station.pay(this.s, merc);
  }

  /** Moves an item from the pack into the vault, at a Waystation only. */
  store(uid: number): string | null {
    return station.store(this.s, uid);
  }

  /** Moves an item from the vault into the pack, at a Waystation only. */
  takeOut(uid: number): string | null {
    return station.takeOut(this.s, uid);
  }

  /**
   * The bearer shouts. Focus marks the enemy under the mouse. Returns why it
   * could not, or null.
   */
  shout(shout: Shout): string | null {
    return shouts.shout(this.s, shout);
  }

  /** Each shout's key, name and seconds until it is ready again. */
  shoutBar(): { shout: Shout; key: string; name: string; left: number; cooldown: number }[] {
    return shouts.shoutBar(this.s);
  }

  start(): void {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.s.last = performance.now();
    this.s.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    cancelAnimationFrame(this.s.frameId);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    input.keyDown(this, this.s, e);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.s.keys.delete(e.key.toLowerCase());
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    input.mouseMove(this.s, e);
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    input.mouseDown(this.s, e);
  };

  private readonly frame = (now: number): void => {
    const s = this.s;
    const dt = Math.min(MAX_FRAME, (now - s.last) / 1000);
    s.last = now;
    render(s, advance(s, dt));
    s.frameId = requestAnimationFrame(this.frame);
  };
}

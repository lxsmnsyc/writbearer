// Places the party stops at: a Waystation's post (wages and the vault), a
// Town's well, and a Camp's fire.
import { Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import { RESTED, shiftMorale } from '../../sim/morale';
import { storeInVault, takeFromVault } from '../inventory';
import type { Due } from '../wages';
import { AREAS_PER_LAYER } from '../../gen/layers';
import { Stream } from '../../core/seed';
import { offersAt, takeCard, waystationOffers } from '../mastery';
import type GameState from './state';
import { LEAVE_REACH, MEET_REACH } from './state';
import { persist } from './saving';

// Area stream ids for a Waystation's offers, apart from the layouts'
const OFFER_STREAM = 2000;

// How near the fire the bearer must come for the party to rest at a Camp
const REST_REACH = 2.2;

// Opens the Waystation's post when the bearer walks up to it.
export function visitStation(g: GameState): void {
  const post = g.stage.station;
  if (!post || g.stationOpen) {
    return;
  }
  const d = Math.hypot(g.bearer.x - post.x, g.bearer.z - post.z);
  if (d > LEAVE_REACH) {
    g.stationMet = false;
  } else if (d <= MEET_REACH && !g.stationMet && g.bearer.alive) {
    g.stationMet = true;
    g.stationOpen = true;
    g.keys.clear();
    g.bearer.order = null;
    g.hooks.onStation?.(true);
    openOffers(g);
  }
}

// At the Waystation of phases 2 to 4 each living merc gets an offer of its own
// spells' upgrades, once. The run is saved with them open.
function openOffers(g: GameState): void {
  if (g.offeredAt === g.stageIndex || !offersAt(Math.floor(g.stageIndex / AREAS_PER_LAYER))) {
    return;
  }
  g.offeredAt = g.stageIndex;
  const rng = g.streams.area(1, Stream.Loot, OFFER_STREAM + g.stageIndex);
  g.offers.push(...waystationOffers(g.mercs(), rng));
  if (g.offers.length > 0) {
    persist(g);
    g.itemsChanged();
  }
}

/** Takes card `i` of the open offer, which closes it. Returns why it failed, or null. */
export function pickCard(g: GameState, i: number): string | null {
  const offer = g.offers.at(0);
  const card = offer?.cards.at(i);
  if (!card) {
    return 'No such card.';
  }
  const why = takeCard(g.mercs(), card, offer?.bonus);
  if (why === null) {
    g.offers.shift();
    g.itemsChanged();
  }
  return why;
}

// Opens the Town's panel when the bearer walks up to the well.
export function visitTown(g: GameState): void {
  const well = g.stage.town;
  if (!well || g.townOpen) {
    return;
  }
  const d = Math.hypot(g.bearer.x - well.x, g.bearer.z - well.z);
  if (d > LEAVE_REACH) {
    g.townMet = false;
  } else if (d <= MEET_REACH && !g.townMet && g.bearer.alive) {
    g.townMet = true;
    g.townOpen = true;
    g.keys.clear();
    g.bearer.order = null;
    g.hooks.onTown?.(true);
  }
}

/** Closes the Town's panel. Walking back to the well opens it again. */
export function closeTown(g: GameState): void {
  g.townOpen = false;
  g.hooks.onTown?.(false);
}

/** Closes the Waystation's post. Walking back to it opens it again. */
export function closeStation(g: GameState): void {
  g.stationOpen = false;
  g.hooks.onStation?.(false);
}

// At a Camp, the party rests by the fire once: the living back to full
// health and mana. The dead stay dead.
export function rest(g: GameState): void {
  const fire = g.stage.rest;
  // An Ambush's fire is a Camp's only once the fight is won.
  if (
    !fire ||
    g.objective?.done === false ||
    g.rested ||
    Math.hypot(g.bearer.x - fire.x, g.bearer.z - fire.z) > REST_REACH
  ) {
    return;
  }
  g.rested = true;
  for (const u of g.sim.living(Side.Party)) {
    u.hp = u.derived.maxHp;
    u.mana = u.derived.maxMana;
    if (u !== g.bearer) {
      shiftMorale(u, RESTED);
    }
  }
  g.say('The party rests by the fire, and rises whole.');
}

/** The wages owed at this Waystation, or none elsewhere. */
export function dues(g: GameState): Due[] {
  return g.payroll?.dues(g.sim) ?? [];
}

/** Pays one merc's wage. Returns why it could not, or null. */
export function pay(g: GameState, merc: Unit): string | null {
  const why = g.payroll?.pay(g.pack, merc) ?? 'Wages are paid only at a Waystation.';
  g.itemsChanged();
  return why;
}

/** Moves an item from the pack into the vault, at a Waystation only. */
export function store(g: GameState, uid: number): string | null {
  const why = g.stage.station
    ? storeInVault(g.pack, g.vault, uid)
    : 'The vault opens only at a Waystation.';
  g.itemsChanged();
  return why;
}

/** Moves an item from the vault into the pack, at a Waystation only. */
export function takeOut(g: GameState, uid: number): string | null {
  const why = g.stage.station
    ? takeFromVault(g.pack, g.vault, uid)
    : 'The vault opens only at a Waystation.';
  g.itemsChanged();
  return why;
}

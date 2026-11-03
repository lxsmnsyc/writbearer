// Starting a run, or resuming one from its save, and choosing its seed and
// mode before it begins.
import { RunStreams, Stream, normalizeSeed, randomSeed } from '../../core/seed';
import RNG from '../../core/rng';
import Sim from '../../sim/sim';
import { Effects } from '../../render/effects';
import { Views } from '../../render/view';
import {
  generateGuild,
  generateStage,
  generateTomb,
  monsterLevel,
  withFightsAhead,
} from '../../gen/stage';
import { AREAS_PER_LAYER, LAYERS } from '../../gen/layers';
import { EVENT_BY_ID } from '../../content/events';
import { BASE_BY_ID, STARTER_PACK } from '../../content/items';
import { potionStack } from '../../gen/loot';
import { rollStartingOffers } from '../../content/recruits';
import { Pack } from '../inventory';
import { Payroll } from '../wages';
import { type RunSave, loadMerc, loadPack } from '../save';
import { START_LEVEL, carryParty, spawnParty } from '../stage';
import MutatorRun from '../mutators';
import Director from '../director';
import type GameState from './state';
import { START_GOLD } from './state';
import { aheadOf, buildStage, fightsAhead, goTo, rollMap, sidesAhead } from './route';
import { GUILD_STREAM, TOMB_STREAM, buildWaystation, enter } from './areas';
import watchSim from './listeners';

// Lays out the saved area again, as it stood when the party entered it.
function resumeArea(g: GameState, save: RunSave): void {
  g.node = save.node && { ...save.node };
  g.path = save.path.map((p) => ({ ...p }));
  g.stage = structuredClone(save.stage);
  for (const id of save.eventsSeen) {
    g.eventsSeen.add(id);
  }
  const def = save.event && EVENT_BY_ID.get(save.event.id);
  g.pendingEvent =
    save.event && def ? { def, rng: new RNG(save.event.state), state: save.event.state } : null;
  g.rested = false;
  if (g.stage.station) {
    g.payroll = new Payroll();
    g.stationMet = false;
  }
}

/** Starts a new run, or resumes a saved one at its area's entrance. */
export function reset(g: GameState, save: RunSave | null, seed: string | undefined): void {
  g.streams = save
    ? RunStreams.load(save.seed, save.streams)
    : new RunStreams(seed ?? randomSeed());
  g.endless = save?.endless ?? g.chosenEndless;
  // The pack comes first: an Event the run starts at deals with it.
  g.pack = new Pack();
  g.pack.gold = START_GOLD;
  g.vault.items.length = 0;
  if (save) {
    loadPack(save, g.pack, g.vault);
  } else {
    for (const [id, count] of STARTER_PACK) {
      const base = BASE_BY_ID.get(id);
      if (base) {
        g.pack.add(potionStack(base, count));
      }
    }
  }
  g.sim = new Sim(g.streams.get(1, Stream.Combat));
  g.director = new Director(g.sim, g.streams.get(1, Stream.Director));
  g.director.standing = save?.standing ?? 0;
  g.metMiniBosses.clear();
  for (const id of save?.miniBosses ?? []) {
    g.metMiniBosses.add(id);
  }
  g.mutators = new MutatorRun(g.sim, () => monsterLevel(g.stageIndex));
  g.stageIndex = save?.stageIndex ?? Math.max(0, (g.options.area ?? 1) - 1);
  g.payroll = null;
  g.mapOpen = false;
  g.souls = 0;
  g.finale = null;
  g.eventsSeen.clear();
  g.eventOpen = false;
  rollMap(g);
  if (save) {
    resumeArea(g, save);
  } else if (g.options.tomb) {
    g.stageIndex = LAYERS.length * AREAS_PER_LAYER;
    g.node = null;
    g.stage = generateTomb(g.streams.area(1, Stream.Layout, TOMB_STREAM), g.stageIndex);
  } else if (g.options.town) {
    goTo(g, g.stageIndex % AREAS_PER_LAYER, 0);
    g.stage = generateStage(g.streams.area(1, Stream.Layout, g.stageIndex), g.stageIndex, {
      kind: 'town',
      ahead: ['combat'],
    });
  } else if (g.options.event) {
    goTo(g, g.stageIndex % AREAS_PER_LAYER, 0);
    g.stage = buildStage(g, 'event');
  } else if (g.options.station) {
    g.stageIndex -= g.stageIndex % AREAS_PER_LAYER;
    g.node = null;
    g.stage = buildWaystation(g);
  } else if (g.startsAtGuild) {
    g.node = null;
    g.stage = generateGuild(
      g.streams.area(1, Stream.Layout, GUILD_STREAM),
      aheadOf(g, null),
      sidesAhead(g),
    );
    withFightsAhead(g.stage, fightsAhead(g, null));
  } else {
    goTo(g, g.stageIndex % AREAS_PER_LAYER, 0);
    g.stage = buildStage(g);
  }
  g.views = new Views();
  g.effects = new Effects(g.sim, g.views);
  g.bearer = spawnParty(g.sim, g.stage, g.options.party ?? []);
  if (save) {
    g.bearer.hp = save.bearer.hp;
    g.bearer.mana = save.bearer.mana;
    for (const m of save.mercs) {
      loadMerc(g.sim, m, g.stage.entrance.x, g.stage.entrance.z);
    }
    carryParty(g.sim, g.stage);
    g.views.snap(g.sim);
  }
  g.starting =
    g.stage.kind === 'guild'
      ? rollStartingOffers(g.streams.get(1, Stream.Recruits), START_LEVEL)
      : [];
  g.title = !save && g.stage.kind === 'guild';
  g.recruiting = null;
  g.hooks.onTitle?.(g.title, g.streams.seed);
  g.hooks.onRecruit?.(null);
  enter(g);
  watchSim(g);
  g.slain = save?.slain ?? 0;
  g.souls = save?.souls ?? 0;
  g.over = false;
  g.ground = [];
  g.goFor();
  g.inventory = false;
  g.stationOpen = false;
  g.notice = null;
  g.hooks.onStation?.(false);
  g.hooks.onEvent?.(null);
  g.select(null);
  g.acc = 0;
  g.hooks.onInventory?.(false);
  g.itemsChanged();
}

/** Starts the run about to begin on another seed, as typed or shared. */
export function setSeed(g: GameState, seed: string): void {
  const clean = normalizeSeed(seed);
  if (!g.title || clean === '' || clean === g.streams.seed) {
    return;
  }
  reset(g, null, clean);
}

/** A link that starts this run's seed, in its mode, for another player. */
export function shareLink(g: GameState): string {
  const seed = encodeURIComponent(g.streams.seed);
  return `${location.origin}${location.pathname}?seed=${seed}${g.endless ? '&endless' : ''}`;
}

/** Switches the run about to begin between story and endless, on its seed. */
export function setEndless(g: GameState, on: boolean): void {
  if (!g.title || on === g.endless) {
    return;
  }
  g.chosenEndless = on;
  reset(g, null, g.streams.seed);
}

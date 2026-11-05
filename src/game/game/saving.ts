// Saving the run as it stands, and ending it.
import { AREAS_PER_LAYER } from '../../gen/layers';
import type { Ending } from '../compendium';
import { type RunSave, SAVE_VERSION, deleteSave, saveItem, saveMerc, writeSave } from '../save';
import { freeControlled } from '../../sim/control';
import type GameState from './state';

/** The run as it stands, for the save. Taken on entering an area. */
export function snapshot(g: GameState): RunSave {
  freeControlled(g.sim);
  const e = g.encounter;
  return {
    version: SAVE_VERSION,
    seed: g.streams.seed,
    endless: g.endless,
    streams: g.streams.save(),
    stageIndex: g.stageIndex,
    node: g.node && { ...g.node },
    path: g.path.map((p) => ({ ...p })),
    stage: structuredClone(g.stage),
    event: e && { id: e.def.id, state: e.state },
    eventsSeen: [...g.eventsSeen],
    souls: g.souls,
    slain: g.slain,
    bearer: { hp: g.bearer.hp, mana: g.bearer.mana },
    mercs: g.mercs().map((m) => saveMerc(m)),
    gold: g.pack.gold,
    pack: g.pack.items.map((i) => saveItem(i)),
    materials: [...g.pack.materials],
    vault: g.vault.items.map((i) => saveItem(i)),
    standing: g.director.standing,
    miniBosses: [...g.metMiniBosses],
    ...(g.offers.length > 0 ? { offers: structuredClone(g.offers) } : {}),
  };
}

// Writes the run as it stands at this area's entrance.
export function persist(g: GameState): void {
  if (g.saving && !g.over) {
    writeSave(snapshot(g));
  }
}

// The run is over, won or lost: its save goes with it, and the
// compendium notes how it ended.
export function endRun(g: GameState, ending: Ending): void {
  if (g.saving) {
    deleteSave();
  }
  if (g.endless) {
    // Endless runs only fall; the compendium keeps the deepest phase.
    g.compendium.reach(Math.floor(g.stageIndex / AREAS_PER_LAYER) + 1);
  } else {
    g.compendium.end(ending);
  }
}

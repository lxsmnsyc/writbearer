// Thieves: the sim's view of the pack. A thief takes from the pack and
// drops it on the ground if it dies with it.
import type RNG from '../../core/rng';
import { Stream } from '../../core/seed';
import { rollGold } from '../../gen/loot';
import type { Loot, Pocket } from '../../sim/theft';
import type GameState from './state';

// With no item to take, a thief takes this share of the gold
export const GOLD_SHARE = 0.25;

// Gold taken, as a share of the purse, never the whole of it.
function goldShare(gold: number): number {
  return Math.min(gold - 1, Math.max(1, Math.floor(gold * GOLD_SHARE)));
}

// Id offset of the area streams thefts draw from
const THEFT_STREAM = 7000;

/** The parts of the run a theft touches. */
export interface TheftHost {
  sim: GameState['sim'];
  pack: GameState['pack'];
  ground: GameState['ground'];
  stageIndex: number;
  streams: GameState['streams'];
  stage: { exits: readonly { x: number; z: number; closed?: boolean }[] };
  itemsChanged(): void;
  say(line: string): void;
}

// Hangs the pack on the sim as the thieves' pocket.
export default function watchTheft(g: TheftHost): void {
  // One stream per area, so a load into an area repeats its thefts
  let drawn: { index: number; rng: RNG } | null = null;
  const stream = (): RNG => {
    if (drawn?.index !== g.stageIndex) {
      drawn = {
        index: g.stageIndex,
        rng: g.streams.area(1, Stream.Combat, THEFT_STREAM + g.stageIndex),
      };
    }
    return drawn.rng;
  };
  const pocket: Pocket = {
    pick(): Loot | null {
      const rng = stream();
      // Equipment worn is on the mercs and potions on belts are theirs, so
      // the pack holds only what is spare. Gold only when no item is left.
      const items = g.pack.items.filter((i) => i.quantity > 0);
      if (items.length > 0) {
        return { item: items[rng.int(0, items.length - 1)] };
      }
      const gold = goldShare(g.pack.gold);
      return gold > 0 ? { gold } : null;
    },
    take(loot) {
      if ('item' in loot) {
        g.pack.take(loot.item.uid);
      } else {
        g.pack.gold = Math.max(0, g.pack.gold - loot.gold);
      }
      g.itemsChanged();
    },
    give(loot, at) {
      const item = 'item' in loot ? loot.item : rollGold(stream(), 1);
      if ('gold' in loot) {
        item.quantity = loot.gold;
      }
      g.ground.push({ item, x: at.x, z: at.z });
      g.itemsChanged();
    },
    exits() {
      return g.stage.exits.filter((e) => !e.closed);
    },
    say: (line) => {
      g.say(line);
    },
  };
  g.sim.pocket = pocket;
}

import type RNG from '../../core/rng';
import type { Stage } from '../../gen/stage';
import type { Kind } from '../../render/rig';
import type { ItemBase } from '../../sim/item';
import type Sim from '../../sim/sim';
import type Unit from '../../sim/unit';
import type { IconName } from '../../ui/icons';
import type { BestiaryEntry } from '../bestiary';
import type { Template } from '../roster';

/**
 * One boss: what the game needs to place, fight, drop, list and draw it.
 * Register it in `BOSSES` (`index.ts`) and name it in its layer's pool.
 * The `field` hook of the boss-def contract comes with the boss-field
 * contract (bp-ground).
 */
export interface BossDef {
  // Also the monster kind: the key of its template in MONSTERS
  id: string;
  name: string;
  // The pool it belongs to
  layer: 0 | 1 | 2 | 3;
  template: Template;
  spawn(sim: Sim, level: number, x: number, z: number): Unit;
  // A field variant: a bridge, islands
  arena?: (stage: Stage, rng: RNG) => void;
  card: ItemBase;
  bestiary: BestiaryEntry;
  // The figure it is drawn as, and its size
  view: { kind: Kind; size: number };
  icon: IconName;
}

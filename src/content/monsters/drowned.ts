import { Hunt } from '../../sim/ai';
import { Element, Race, Range } from '../../sim/types';
import type { Template } from '../jobs';
import { job, stats } from '../jobs/stats';

// The drowned of the Undercroft.
const DROWNED = {
  // A cracked bell hung in the flooded hall. It never moves and never
  // strikes: while other monsters stand near it, it rings Dread across a wide
  // area (set up in dread-steps).
  drownedBell: {
    job: job('Drowned Bell', 170, 16, 0, Range.Melee),
    base: stats(1, 1, 8, 1, 1, 1),
    weapon: { min: 0, max: 0, matk: 0 },
    kit: { reach: 0, interval: 99, hitAt: 0.5, moveSpeed: 0, notice: 6 },
    modifiers: [{ stat: 'armor', add: 25 }],
    race: Race.Construct,
    element: Element.Spectral,
    hunt: Hunt.Nearest,
  },
} satisfies Record<string, Template>;

export default DROWNED;

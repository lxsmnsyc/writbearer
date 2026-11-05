import { Hunt } from '../../sim/ai';
import { Element, Race, Range } from '../../sim/types';
import type { Template } from '../jobs';
import { job, stats } from '../jobs/stats';

// The Hollowed beyond the first: the ones who whisper and the ones who hide.
const HOLLOWED = {
  // A Hollowed that follows the others and murmurs. Frail, and it keeps
  // behind them; the dread builds up in anyone within 4 tiles of it (set up
  // in dread-steps).
  whisperer: {
    job: job('Whisperer', 70, 7, 40, Range.Melee),
    base: stats(3, 6, 4, 10, 6, 12),
    weapon: { min: 5, max: 8, matk: 10 },
    kit: { reach: 1.0, interval: 1.5, hitAt: 0.6, moveSpeed: 2.2, notice: 6 },
    race: Race.Human,
    element: Element.Occult,
    hunt: Hunt.Support,
  },
  // A Hollowed in a hood with long claws. It starts hidden and stalks the
  // bearer, strikes from 2 tiles and vanishes again (set up in dread-steps,
  // driven by ai/skulker).
  skulker: {
    job: job('Skulker', 90, 9, 0, Range.Melee),
    base: stats(9, 16, 4, 1, 12, 1),
    weapon: { min: 14, max: 19, matk: 0 },
    kit: { reach: 1.0, interval: 0.8, hitAt: 0.45, moveSpeed: 3.4, notice: 8 },
    race: Race.Human,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Assassin,
  },
} satisfies Record<string, Template>;

export default HOLLOWED;

import { Hunt } from '../../sim/ai';
import { Element, Race, Range, Rank } from '../../sim/types';
import type { Template } from '../jobs';
import { job, stats } from '../jobs/stats';

// What the bearer carried down.
const CREDITOR = {
  // What the bearer carried down: the Creditor, woken in the bearer's body
  // when the seal breaks. Its strength and its skill are set up in
  // creditor.ts.
  creditor: {
    job: job('The Creditor', 2600, 220, 200, Range.Melee),
    base: stats(18, 10, 18, 18, 14, 18),
    weapon: { min: 24, max: 32, matk: 30 },
    kit: { reach: 1.5, interval: 1.2, hitAt: 0.5, moveSpeed: 2.2, notice: 20 },
    modifiers: [{ stat: 'armor', add: 30 }],
    race: Race.Human,
    rank: Rank.Boss,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Nearest,
  },
} satisfies Record<string, Template>;

export default CREDITOR;

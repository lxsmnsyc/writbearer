import { Hunt } from '../../sim/ai';
import { Element, Race, Range, Rank } from '../../sim/types';
import type { Template } from '../jobs';
import { job, stats } from '../jobs/stats';
import { BURST } from '../monster-skills';

// The Blight.
const BLIGHT = {
  // A Blight mite: a crawler not yet grown. Quick, frail, and never alone.
  mite: {
    job: job('Mite', 38, 5, 0, Range.Melee),
    base: stats(4, 8, 2, 1, 4, 1),
    weapon: { min: 4, max: 7, matk: 0 },
    kit: { reach: 0.8, interval: 0.9, hitAt: 0.45, moveSpeed: 2.8, notice: 4 },
    race: Race.Insect,
    element: Element.Venom,
    hunt: Hunt.Nearest,
  },
  // A Blight crawler. It bites whoever is closest.
  crawler: {
    job: job('Crawler', 110, 10, 0, Range.Melee),
    base: stats(8, 10, 8, 1, 6, 1),
    weapon: { min: 9, max: 13, matk: 0 },
    kit: { reach: 1.0, interval: 0.8, hitAt: 0.5, moveSpeed: 2.6, notice: 5 },
    race: Race.Beast,
    element: Element.Venom,
    // Its bite builds up poison.
    attackElement: Element.Venom,
    hunt: Hunt.Nearest,
  },
  // A Blight bloat: a slow, swollen sac on legs. It walks into the party
  // and bursts in a cloud of Venom, shown on the ground first. Killed
  // before it bursts, it only pops.
  bloat: {
    job: job('Bloat', 90, 9, 0, Range.Melee),
    base: stats(8, 2, 6, 1, 4, 1),
    weapon: { min: 14, max: 18, matk: 0 },
    kit: { reach: 1.0, interval: 99, hitAt: 0.5, moveSpeed: 1.4, notice: 6 },
    race: Race.Insect,
    element: Element.Venom,
    attackElement: Element.Venom,
    hunt: Hunt.Bearer,
    skills: [BURST],
  },
  // The Marches' boss: a Blight crawler grown huge, swollen with eggs. Slow,
  // and she lays mites. Her skill and her frenzy are set up in brood.ts.
  broodMother: {
    job: job('Brood Mother', 2000, 200, 120, Range.Melee),
    base: stats(14, 6, 16, 1, 10, 8),
    weapon: { min: 20, max: 28, matk: 0 },
    kit: { reach: 1.8, interval: 1.5, hitAt: 0.5, moveSpeed: 1.5, notice: 6 },
    modifiers: [{ stat: 'armor', add: 20 }],
    race: Race.Insect,
    rank: Rank.Boss,
    element: Element.Venom,
    attackElement: Element.Venom,
    hunt: Hunt.Nearest,
  },
} satisfies Record<string, Template>;

export default BLIGHT;

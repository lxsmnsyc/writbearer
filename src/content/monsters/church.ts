import { Hunt } from '../../sim/ai';
import { Element, Race, Range, Rank } from '../../sim/types';
import type { Template } from '../jobs';
import { job, stats } from '../jobs/stats';
import { HYMN } from '../monster-skills';

// The Church's Penitents and their keepers.
const CHURCH = {
  // A Penitent with a sling. It keeps well back and slings stones at the
  // bearer. Radiant, as the Church's keepers are.
  penitentSlinger: {
    job: job('Penitent slinger', 80, 8, 0, Range.Ranged),
    base: stats(4, 10, 4, 1, 12, 1),
    weapon: { min: 7, max: 11, matk: 0 },
    kit: { reach: 6, interval: 1.5, hitAt: 0.6, moveSpeed: 2.6, notice: 6 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Bearer,
  },
  // A Penitent of the Church, keeping the seal with a knife. Fast and fragile,
  // and it wants the bearer. Radiant, so holy attacks cannot hurt it.
  penitent: {
    job: job('Penitent', 90, 8, 30, Range.Melee),
    base: stats(7, 12, 4, 6, 10, 4),
    weapon: { min: 10, max: 14, matk: 0 },
    kit: { reach: 1.0, interval: 1.0, hitAt: 0.55, moveSpeed: 2.4, notice: 6 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Bearer,
  },
  // A Penitent who leads the rites in song. It keeps behind the others and
  // mends them with a long hymn.
  cantor: {
    job: job('Penitent Cantor', 110, 10, 80, Range.Melee),
    base: stats(4, 6, 6, 14, 8, 12),
    weapon: { min: 6, max: 9, matk: 20 },
    kit: { reach: 1.0, interval: 1.4, hitAt: 0.6, moveSpeed: 2.1, notice: 5 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Support,
    skills: [HYMN],
  },
  // A Penitent who listened too long to the whispers. It lopes past anyone
  // in its way to claw at the bearer, and its touch is Occult: dread builds
  // up in whoever it strikes.
  hollowed: {
    job: job('Hollowed', 120, 11, 0, Range.Melee),
    base: stats(9, 14, 5, 1, 9, 1),
    weapon: { min: 12, max: 17, matk: 0 },
    kit: { reach: 1.0, interval: 0.75, hitAt: 0.45, moveSpeed: 3.0, notice: 7 },
    race: Race.Human,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Assassin,
  },
  // The Undercroft's boss: the head of the Penitents who keep the seal. She
  // keeps back, calls her flock and sanctifies it.
  abbess: {
    job: job('The Abbess', 1000, 100, 240, Range.Melee),
    base: stats(6, 8, 12, 18, 10, 18),
    weapon: { min: 12, max: 18, matk: 40 },
    kit: { reach: 1.0, interval: 1.4, hitAt: 0.6, moveSpeed: 2.0, notice: 6 },
    race: Race.Human,
    rank: Rank.Boss,
    element: Element.Radiant,
    hunt: Hunt.Support,
  },
  // The Sunken Crown's boss: a saint of the Church who listened too long.
  // Dread gathers around her, and she leaps for the bearer.
  hollowedSaint: {
    job: job('The Hollowed Saint', 1850, 180, 0, Range.Melee),
    base: stats(14, 16, 12, 1, 12, 1),
    weapon: { min: 16, max: 22, matk: 0 },
    kit: { reach: 1.2, interval: 1.1, hitAt: 0.45, moveSpeed: 2.8, notice: 6 },
    race: Race.Human,
    rank: Rank.Boss,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Assassin,
  },
} satisfies Record<string, Template>;

export default CHURCH;

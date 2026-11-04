import { Hunt } from '../../sim/ai';
import { Race, Range, Rank } from '../../sim/types';
import type { Template } from '../jobs';
import { job, stats } from '../jobs/stats';

// The Old King's guard and dead.
const OLD_KING = {
  // One of the Old King's dead. It goes for the bearer.
  hollowSoldier: {
    job: job('Hollow soldier', 150, 14, 0, Range.Melee),
    base: stats(10, 4, 10, 1, 8, 1),
    weapon: { min: 16, max: 22, matk: 0 },
    kit: { reach: 1.2, interval: 1.3, hitAt: 0.6, moveSpeed: 2.0, notice: 5 },
    modifiers: [{ stat: 'armor', add: 30 }],
    race: Race.Undead,
    hunt: Hunt.Bearer,
  },
  // A soldier of the Old King's guard with a long bow. It shoots from
  // behind its own and steps back from whoever comes close.
  hollowArcher: {
    job: job('Hollow archer', 110, 10, 0, Range.Ranged),
    base: stats(6, 8, 6, 1, 14, 1),
    weapon: { min: 10, max: 14, matk: 0 },
    kit: { reach: 6, interval: 1.8, hitAt: 0.7, moveSpeed: 1.9, notice: 6 },
    modifiers: [{ stat: 'armor', add: 15 }],
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A soldier of the Old King's guard behind a tower shield taller than it.
  // The shield takes most of every physical blow from the front, and it
  // turns slowly, so it is beaten from the side or behind, or with magic.
  hollowShieldbearer: {
    job: job('Hollow Shieldbearer', 170, 15, 0, Range.Melee),
    base: stats(9, 3, 12, 1, 8, 1),
    weapon: { min: 12, max: 16, matk: 0 },
    kit: { reach: 1.1, interval: 1.5, hitAt: 0.6, moveSpeed: 1.7, notice: 5, turn: 1.4 },
    modifiers: [
      { stat: 'armor', add: 30 },
      { stat: 'blockChance', add: 100 },
      { stat: 'blockAmount', add: 80 },
    ],
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A soldier of the Old King's guard with a curled horn instead of a spear.
  // When its pack wakes it runs for the nearest horn post, to blow it and
  // call a fresh pack. Lightly armored and quick, and weak once cornered.
  hornBearer: {
    job: job('Horn-Bearer', 110, 10, 0, Range.Melee),
    base: stats(6, 8, 6, 1, 6, 1),
    weapon: { min: 8, max: 12, matk: 0 },
    kit: { reach: 1.0, interval: 1.4, hitAt: 0.6, moveSpeed: 2.6, notice: 5 },
    modifiers: [{ stat: 'armor', add: 10 }],
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A horn post: a pole with the guard's great horn on it. It does nothing,
  // and is there to be broken before a Horn-Bearer reaches it.
  hornPost: {
    job: job('Horn post', 160, 16, 0, Range.Melee),
    base: stats(1, 1, 8, 1, 1, 1),
    weapon: { min: 0, max: 0, matk: 0 },
    kit: { reach: 0, interval: 99, hitAt: 0.5, moveSpeed: 0, notice: 0 },
    modifiers: [{ stat: 'armor', add: 20 }],
    race: Race.Construct,
    hunt: Hunt.Nearest,
  },
  // One of the drowned townsfolk of the sunken capital, risen with the Old
  // King's guard. Slow and weak alone; it shambles at whoever is nearest.
  husk: {
    job: job('Husk', 70, 9, 0, Range.Melee),
    base: stats(6, 2, 6, 1, 4, 1),
    weapon: { min: 7, max: 11, matk: 0 },
    kit: { reach: 1.0, interval: 1.5, hitAt: 0.6, moveSpeed: 1.5, notice: 4 },
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // The Rift Road's boss: the Old King's captain, holding the road down. Heavy
  // armor, and a slow cleave across everything in front of him. His skills
  // and his horn are set up in bosses.ts.
  gatekeeper: {
    job: job('The Gatekeeper', 2150, 200, 60, Range.Melee),
    base: stats(18, 4, 18, 1, 10, 6),
    weapon: { min: 26, max: 34, matk: 0 },
    kit: { reach: 1.6, interval: 1.8, hitAt: 0.6, moveSpeed: 1.7, notice: 6 },
    modifiers: [{ stat: 'armor', add: 70 }],
    race: Race.Undead,
    rank: Rank.Boss,
    hunt: Hunt.Nearest,
  },
} satisfies Record<string, Template>;

export default OLD_KING;

import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type Sim from './sim';
import { DREAD } from './statuses';
import { Rank, Side } from './types';
import type Unit from './unit';

// Morale and Discipline, from the mercenaries design. Morale is how a merc
// feels about the job, 0 to 100. Discipline is how well it follows the
// player's orders, 0 to 100. Morale scales Discipline in a fight.

export const enum Morale {
  Broken = 0,
  Low = 1,
  Normal = 2,
  High = 3,
}

export const MORALE_START = 60;
// The least morale of each level
const HIGH_AT = 75;
const NORMAL_AT = 40;
const LOW_AT = 15;

// How much Discipline each morale level keeps in a fight.
const FACTOR: Record<Morale, number> = {
  [Morale.High]: 1,
  [Morale.Normal]: 0.9,
  [Morale.Low]: 0.7,
  [Morale.Broken]: 0.5,
};

export const MORALE_NAME: Record<Morale, string> = {
  [Morale.High]: 'High',
  [Morale.Normal]: 'Normal',
  [Morale.Low]: 'Low',
  [Morale.Broken]: 'Broken',
};

// What shifts morale
export const PAID = 10;
export const UNPAID = -40;
export const UNPAID_DISCIPLINE = -10;
export const RESTED = 10;
const ALLY_DIED = -10;
const DREADED = -8;
const ELITE_SLAIN = 4;
const BOSS_SLAIN = 15;
// A Loyal merc takes losses of morale at this share.
const LOYAL_LOSS = 0.5;

export function moraleOf(u: Unit): Morale {
  if (u.morale >= HIGH_AT) {
    return Morale.High;
  }
  if (u.morale >= NORMAL_AT) {
    return Morale.Normal;
  }
  return u.morale >= LOW_AT ? Morale.Low : Morale.Broken;
}

/** Discipline as morale scales it in a fight. */
export const effectiveDiscipline = (u: Unit): number =>
  Math.round(Math.min(100, u.discipline + u.disciplineBonus) * FACTOR[moraleOf(u)]);

/**
 * How many of its target priorities a merc follows, by its effective
 * Discipline: 1 below 20, 2 below 60, 3 from 60. A Veteran follows one more.
 */
export function prioritiesFollowed(u: Unit): number {
  const d = effectiveDiscipline(u);
  let n = 3;
  if (d < 20) {
    n = 1;
  } else if (d < 60) {
    n = 2;
  }
  return n + (u.traits.includes('veteran') ? 1 : 0);
}

/** Whether a merc holds a skill set to Elites for them, from 20 Discipline. */
export const honoursElites = (u: Unit): boolean => effectiveDiscipline(u) >= 20;

/** Shifts a merc's morale, within 0 to 100. A Loyal merc loses half as much. */
export function shiftMorale(u: Unit, by: number): void {
  const delta = by < 0 && u.traits.includes('loyal') ? by * LOYAL_LOSS : by;
  u.morale = Math.max(0, Math.min(100, u.morale + delta));
}

/** Shifts a merc's Discipline, within 0 to 100. */
export function shiftDiscipline(u: Unit, by: number): void {
  u.discipline = Math.max(0, Math.min(100, u.discipline + by));
}

const mercs = (sim: Sim): Unit[] => sim.living(Side.Party).filter((u) => u !== sim.bearer);

/**
 * What moves morale in a fight: a fellow merc's death lowers it, an elite's
 * or a boss's raises it, and Dread taking hold lowers the dreaded merc's.
 */
export default function setupMorale(sim: Sim): void {
  sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
    const dead = event.source;
    if (dead.side === Side.Party && dead !== sim.bearer) {
      for (const m of mercs(sim)) {
        shiftMorale(m, ALLY_DIED);
      }
    } else if (dead.side === Side.Monster && dead.rank !== Rank.Normal) {
      for (const m of mercs(sim)) {
        shiftMorale(m, dead.rank === Rank.Boss ? BOSS_SLAIN : ELITE_SLAIN);
      }
    }
  });
  sim.on(SimEvents.StatusApplied, EventPriority.Post, (event) => {
    if (event.status.def === DREAD && event.status.unit.side === Side.Party) {
      shiftMorale(event.status.unit, DREADED);
    }
  });
}

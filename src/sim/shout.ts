import { effectiveDiscipline } from './morale';
import type Sim from './sim';
import { Side } from './types';
import type Unit from './unit';

/** The bearer's shouts. Each overrides the mercs' orders for a few seconds. */
export const enum Shout {
  // Every merc gathers on the bearer and fights only what comes near it.
  Rally = 0,
  // Every merc goes for the marked enemy.
  Focus = 1,
  // Every merc breaks off and runs behind the bearer, away from the fight.
  FallBack = 2,
  // Every merc stands where it is.
  Hold = 3,
}

export interface ShoutDef {
  name: string;
  // Seconds the order lasts, and before it can be shouted again
  duration: number;
  cooldown: number;
}

export const SHOUTS: Record<Shout, ShoutDef> = {
  [Shout.Rally]: { name: 'Rally', duration: 5, cooldown: 12 },
  [Shout.Focus]: { name: 'Focus', duration: 6, cooldown: 10 },
  [Shout.FallBack]: { name: 'Fall back', duration: 3, cooldown: 12 },
  [Shout.Hold]: { name: 'Hold', duration: 6, cooldown: 10 },
};

export const ALL_SHOUTS: readonly Shout[] = [Shout.Rally, Shout.Focus, Shout.FallBack, Shout.Hold];

/** A shout as one merc heard it: when it acts on it, until when, and on whom. */
export interface Heard {
  shout: Shout;
  from: number;
  until: number;
  target: Unit | null;
}

/**
 * How long a merc takes to act on a shout, from the mercenaries design:
 * 0.2 seconds, plus a hundredth of a second for each point of effective
 * Discipline below 100.
 */
export const responseDelay = (u: Unit): number => 0.2 + (100 - effectiveDiscipline(u)) * 0.01;

/** Seconds until a shout can be given again. */
export const cooldownLeft = (sim: Sim, shout: Shout): number =>
  Math.max(0, (sim.shoutReady[shout] ?? 0) - sim.time);

/**
 * The bearer shouts. Every living merc hears it and acts on it after its
 * response delay. Focus needs a living enemy to mark. Returns why the shout
 * could not be given, or null.
 */
export function cry(sim: Sim, shout: Shout, target: Unit | null = null): string | null {
  const bearer = sim.bearer;
  const def = SHOUTS[shout];
  if (!bearer?.alive) {
    return 'The bearer cannot shout.';
  }
  const wait = cooldownLeft(sim, shout);
  if (wait > 0) {
    return `${def.name} is ready in ${Math.ceil(wait)} seconds.`;
  }
  if (shout === Shout.Focus && (!target?.alive || target.side !== Side.Monster)) {
    return 'Point at an enemy to focus on it.';
  }
  sim.shoutReady[shout] = sim.time + def.cooldown;
  for (const merc of sim.living(Side.Party)) {
    if (merc !== bearer) {
      const from = sim.time + responseDelay(merc);
      merc.heard = { shout, from, until: from + def.duration, target };
    }
  }
  return null;
}

/** The shout a merc is acting on now, if any. */
export function acting(sim: Sim, u: Unit): Heard | null {
  const heard = u.heard;
  if (!heard || sim.time < heard.from) {
    return null;
  }
  if (sim.time >= heard.until || (heard.shout === Shout.Focus && !heard.target?.alive)) {
    u.heard = null;
    return null;
  }
  return heard;
}

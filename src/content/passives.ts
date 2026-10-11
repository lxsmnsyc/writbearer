import type { Lifecycle } from '../core/lifecycle';
import { EventPriority } from '../core/event-emitter';
import { type SimEventMap, SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import type { Passive } from '../sim/skill';
import { SHOCK, SUNDERED } from '../sim/statuses';
import { DamageFlags, DamageKind, DamagePriority, Range, ValuePriority } from '../sim/types';

// First numbers for passive skills. A starting point for balance.

// A listener that is added on start and removed on stop, so passives that
// are set up again at a new rank leave nothing behind.
function listen<K extends keyof SimEventMap>(
  sim: Sim,
  type: K,
  priority: SimEventMap[K][1],
  listener: (event: SimEventMap[K][0]) => void,
): Lifecycle {
  return {
    start: () => {
      sim.on(type, priority, listener);
    },
    stop: () => {
      sim.off(type, priority, listener);
    },
  };
}

/** Vanguard, Breaker tier 1. Melee hits break armor: 4 per rank, stacking 5 times. */
export const SUNDER: Passive = {
  id: 'sunder',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (
        event.source === unit &&
        event.range === Range.Melee &&
        event.value > 0 &&
        !(event.flags & DamageFlags.DoT)
      ) {
        event.target.addStatus(SUNDERED, unit, undefined, rank);
      }
    }),
};
export const sunderText = (rank: number): string =>
  `Melee hits take ${4 * rank} armor from the target for 4 seconds, stacking 5 times.`;

const VOW_RADIUS = 4;

/** Vanguard, Oathkeeper tier 1. More armor while near the bearer. */
export const VOW: Passive = {
  id: 'vow',
  setup: (unit, rank) => {
    let near = false;
    const tick = listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const bearer = unit.sim.bearer;
      const now = bearer !== null && bearer.alive && unit.distanceTo(bearer) <= VOW_RADIUS;
      if (now !== near) {
        near = now;
        unit.setBonus('vow', now ? [{ stat: 'armor', add: 10 * rank }] : null);
      }
    });
    return {
      start: () => {
        tick.start();
      },
      stop: () => {
        tick.stop();
        unit.setBonus('vow', null);
      },
    };
  },
};
export const vowText = (rank: number): string =>
  `+${10 * rank} armor while within ${VOW_RADIUS} tiles of the bearer.`;

/** Vanguard, Oathkeeper tier 3. Takes a share of every hit on the bearer. */
export const SHARED_BURDEN: Passive = {
  id: 'sharedBurden',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Pre, (event) => {
      if (
        event.target !== unit.sim.bearer ||
        !unit.alive ||
        event.value <= 0 ||
        event.flags & DamageFlags.Redirected
      ) {
        return;
      }
      const taken = Math.floor(event.value * 0.05 * rank);
      if (taken > 0) {
        event.value -= taken;
        event.source.hit(unit, {
          kind: DamageKind.True,
          fixed: taken,
          flags: DamageFlags.Redirected,
        });
      }
    }),
};
export const sharedBurdenText = (rank: number): string =>
  `Takes ${5 * rank}% of every hit on the bearer.`;

/** Ranger, Hawkeye tier 3. Longer reach and surer aim. */
export const EAGLE_EYE: Passive = {
  id: 'eagleEye',
  setup: (unit, rank) => ({
    start: () => {
      unit.kit.reach += 0.5 * rank;
      unit.setBonus('eagleEye', [{ stat: 'accuracy', add: 3 * rank }]);
    },
    stop: () => {
      unit.kit.reach -= 0.5 * rank;
      unit.setBonus('eagleEye', null);
    },
  }),
};
export const eagleEyeText = (rank: number): string =>
  `+${0.5 * rank} tiles of reach and +${3 * rank} accuracy.`;

/** Ranger, Stormcaller tier 2. Storm hits build up Shock faster. */
export const STATIC: Passive = {
  id: 'static',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.CheckBuildup, ValuePriority.Multiplicative, (event) => {
      if (event.source === unit && event.status === SHOCK) {
        event.value *= 1 + 0.25 * rank;
      }
    }),
};
export const staticText = (rank: number): string => `+${25 * rank}% Shock buildup.`;

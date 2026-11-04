import { canRaise } from '../corpse';
import {
  type Buildup,
  type CheckHitEvent,
  SimEvents,
  type UnitDamageEvent,
  type UnitHealEvent,
} from '../events';
import { DamageFlags, DamageKind, type Element, type Range } from '../types';
import type Unit from '../unit';

export interface HitOptions {
  kind?: DamageKind;
  range?: Range;
  element?: Element;
  ratio?: number;
  flat?: number;
  fixed?: number;
  flags?: number;
  buildup?: Buildup[];
}

/**
 * One hit on `target`. Physical hits roll to hit first. Returns the
 * damage event, or null on a miss.
 */
export function hit(unit: Unit, target: Unit, options: HitOptions = {}): UnitDamageEvent | null {
  const kind = options.kind ?? DamageKind.Physical;
  const range = options.range ?? unit.job.range;
  let flags = options.flags ?? 0;

  if (kind === DamageKind.Physical) {
    const check: CheckHitEvent = {
      id: 'CheckHit',
      disabled: false,
      source: unit,
      target,
      range,
      flags,
      critRate: 0,
      hitChance: 0,
      critical: false,
      hit: false,
    };
    unit.sim.emit(SimEvents.CheckHit, check);
    if (!check.hit) {
      unit.sim.emit(SimEvents.UnitMiss, {
        id: 'UnitMiss',
        disabled: false,
        source: unit,
        target,
        flags,
      });
      return null;
    }
    if (check.critical) {
      flags |= DamageFlags.Critical;
    }
  }

  const event: UnitDamageEvent = {
    id: 'UnitDamage',
    disabled: false,
    source: unit,
    target,
    kind,
    range,
    element: options.element ?? unit.attackElement,
    ratio: options.ratio ?? 100,
    flat: options.flat ?? 0,
    fixed: options.fixed,
    flags,
    buildup: options.buildup ?? [],
    value: 0,
  };
  unit.sim.emit(SimEvents.UnitDamage, event);
  return event;
}

export function heal(unit: Unit, target: Unit, value: number, flags = 0): UnitHealEvent {
  const event: UnitHealEvent = {
    id: 'UnitHeal',
    disabled: false,
    source: unit,
    target,
    flags,
    value,
  };
  unit.sim.emit(SimEvents.UnitHeal, event);
  return event;
}

/**
 * Brings a dead unit back from its corpse with a share of its health.
 * A torn body cannot come back. Returns whether it did.
 */
export function revive(unit: Unit, share: number): boolean {
  if (!canRaise(unit)) {
    return false;
  }
  unit.alive = true;
  unit.lastBlow = null;
  unit.hp = Math.max(1, Math.floor(unit.derived.maxHp * share));
  unit.target = null;
  unit.sim.emit(SimEvents.UnitRevived, { id: 'UnitRevived', disabled: false, source: unit });
  return true;
}

export function die(unit: Unit, killer: Unit | null): void {
  unit.sim.emit(SimEvents.UnitDies, { id: 'UnitDies', disabled: false, source: unit, killer });
}

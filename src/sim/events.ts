import type { BaseEvent, EventPriority } from '../core/event-emitter';
import type { EventMap } from '../core/event-engine';
import type {
  DamageKind,
  DamagePriority,
  Element,
  HealPriority,
  Range,
  ValuePriority,
} from './types';
import type Unit from './unit';

export const enum SimEvents {
  CheckHit = 'CheckHit',
  UnitMiss = 'UnitMiss',
  UnitDamage = 'UnitDamage',
  UnitHeal = 'UnitHeal',
  UnitDies = 'UnitDies',
}

/**
 * Asks whether a physical hit lands and whether it is a critical.
 * `critRate` and `hitChance` are percents. The rolls happen on `Exact`.
 */
export interface CheckHitEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  range: Range;
  flags: number;
  critRate: number;
  hitChance: number;
  critical: boolean;
  hit: boolean;
}

export interface UnitMissEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  flags: number;
}

/**
 * One hit. `value` starts at 0 and each step of the pipeline changes it.
 * On `Exact` it becomes the health actually removed.
 */
export interface UnitDamageEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  kind: DamageKind;
  range: Range;
  element: Element;
  // Skill percent and flat bonus. A basic attack is 100 and 0.
  ratio: number;
  flat: number;
  // A set amount instead of a roll, such as a damage over time tick.
  fixed?: number;
  flags: number;
  value: number;
}

export interface UnitHealEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  flags: number;
  value: number;
}

export interface UnitDiesEvent extends BaseEvent {
  source: Unit;
  killer: Unit | null;
}

/** Which event carries which shape, on which priority scale. */
export interface SimEventMap extends EventMap {
  [SimEvents.CheckHit]: [CheckHitEvent, ValuePriority];
  [SimEvents.UnitMiss]: [UnitMissEvent, EventPriority];
  [SimEvents.UnitDamage]: [UnitDamageEvent, DamagePriority];
  [SimEvents.UnitHeal]: [UnitHealEvent, HealPriority];
  [SimEvents.UnitDies]: [UnitDiesEvent, EventPriority];
}

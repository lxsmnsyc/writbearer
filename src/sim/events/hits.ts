import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type { DamageKind, DamagePriority, Element, Range, ValuePriority } from '../types';
import type { StatusDef } from '../status';
import type Unit from '../unit';
import type { SimEvents } from '../events';

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

/** Asks whether a unit may pick a hostile unit as a target. Listeners set `allowed` to false. */
export interface CheckTargetEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  allowed: boolean;
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
  // Buildup the hit adds on top of its element's, such as a Shield Bash's stun
  buildup: Buildup[];
  value: number;
}

export interface Buildup {
  status: StatusDef;
  amount: number;
}

/**
 * Asks which elements a unit's attacks may take, for the "weak to my
 * element" target priority. `elements` starts as the unit's attack element.
 */
export interface CheckAttackElementsEvent extends BaseEvent {
  source: Unit;
  elements: Element[];
}

export interface HitEventMap {
  [SimEvents.CheckHit]: [CheckHitEvent, ValuePriority];
  [SimEvents.CheckTarget]: [CheckTargetEvent, ValuePriority];
  [SimEvents.UnitMiss]: [UnitMissEvent, EventPriority];
  [SimEvents.UnitDamage]: [UnitDamageEvent, DamagePriority];
  [SimEvents.CheckAttackElements]: [CheckAttackElementsEvent, ValuePriority];
}

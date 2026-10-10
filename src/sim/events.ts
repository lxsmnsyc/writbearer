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
import type { Skill } from './skill';
import type { ActiveStatus, StatusDef } from './status';
import type Unit from './unit';

export const enum SimEvents {
  CheckHit = 'CheckHit',
  UnitMiss = 'UnitMiss',
  UnitDamage = 'UnitDamage',
  UnitHeal = 'UnitHeal',
  UnitDies = 'UnitDies',
  CheckSkillCost = 'CheckSkillCost',
  UnitSkillWindup = 'UnitSkillWindup',
  UnitSkillRelease = 'UnitSkillRelease',
  CheckBuildup = 'CheckBuildup',
  CheckStatusDuration = 'CheckStatusDuration',
  StatusApplied = 'StatusApplied',
  StatusRemoved = 'StatusRemoved',
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
  // Buildup the hit adds on top of its element's, such as a Shield Bash's stun
  buildup: Buildup[];
  value: number;
}

export interface Buildup {
  status: StatusDef;
  amount: number;
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

/** Asks the final mana cost of a skill. `value` starts at the skill's cost. */
export interface CheckSkillCostEvent extends BaseEvent {
  source: Unit;
  skill: Skill;
  value: number;
}

/** A skill's windup begins. Disabling it cancels the skill before mana is spent. */
export interface UnitSkillWindupEvent extends BaseEvent {
  source: Unit;
  skill: Skill;
  target: Unit | null;
}

/** A skill takes effect. Disabling it makes the skill fizzle. */
export interface UnitSkillReleaseEvent extends BaseEvent {
  source: Unit;
  skill: Skill;
  target: Unit | null;
}

/** Asks how much buildup a hit adds. `value` starts at the base amount. */
export interface CheckBuildupEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  status: StatusDef;
  value: number;
}

/** Asks how long a status lasts on this target, in seconds. */
export interface CheckStatusDurationEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  status: StatusDef;
  value: number;
}

export interface StatusEvent extends BaseEvent {
  status: ActiveStatus;
}

/** Which event carries which shape, on which priority scale. */
export interface SimEventMap extends EventMap {
  [SimEvents.CheckHit]: [CheckHitEvent, ValuePriority];
  [SimEvents.UnitMiss]: [UnitMissEvent, EventPriority];
  [SimEvents.UnitDamage]: [UnitDamageEvent, DamagePriority];
  [SimEvents.UnitHeal]: [UnitHealEvent, HealPriority];
  [SimEvents.UnitDies]: [UnitDiesEvent, EventPriority];
  [SimEvents.CheckSkillCost]: [CheckSkillCostEvent, ValuePriority];
  [SimEvents.UnitSkillWindup]: [UnitSkillWindupEvent, EventPriority];
  [SimEvents.UnitSkillRelease]: [UnitSkillReleaseEvent, EventPriority];
  [SimEvents.CheckBuildup]: [CheckBuildupEvent, ValuePriority];
  [SimEvents.CheckStatusDuration]: [CheckStatusDurationEvent, ValuePriority];
  [SimEvents.StatusApplied]: [StatusEvent, EventPriority];
  [SimEvents.StatusRemoved]: [StatusEvent, EventPriority];
}

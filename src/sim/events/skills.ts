import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type { ValuePriority } from '../types';
import type { Projectile } from '../projectile';
import type { Skill } from '../skill';
import type Unit from '../unit';
import type { SimEvents } from '../events';

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

/** Asks the rank a unit uses a skill at. `value` starts at the learned rank, at least 1. */
export interface CheckSkillRankEvent extends BaseEvent {
  source: Unit;
  skill: string;
  value: number;
}

/**
 * A projectile is about to strike `target`. Disabling the event stops the
 * projectile there: no hit, and it flies no further.
 */
export interface CheckProjectileEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  projectile: Projectile;
}

export interface SkillEventMap {
  [SimEvents.CheckSkillCost]: [CheckSkillCostEvent, ValuePriority];
  [SimEvents.UnitSkillWindup]: [UnitSkillWindupEvent, EventPriority];
  [SimEvents.UnitSkillRelease]: [UnitSkillReleaseEvent, EventPriority];
  [SimEvents.CheckSkillRank]: [CheckSkillRankEvent, ValuePriority];
  [SimEvents.CheckProjectile]: [CheckProjectileEvent, EventPriority];
}

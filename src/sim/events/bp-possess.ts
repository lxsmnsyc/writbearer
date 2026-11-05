import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type { Skill } from '../skill';
import type Unit from '../unit';
import type { SimEvents } from '../events';

/** A merc turns to the monster side for a while. `by` is who took it. */
export interface UnitControlledEvent extends BaseEvent {
  source: Unit;
  by: Unit;
}

/** A controlled merc goes back to its side, its hunt and its orders. */
export interface UnitFreedEvent extends BaseEvent {
  source: Unit;
}

/** A unit casts a skill it copied from `from`, at the rank `from` had. */
export interface SkillCopiedEvent extends BaseEvent {
  source: Unit;
  from: Unit;
  skill: Skill;
  rank: number;
}

export interface PossessEventMap {
  [SimEvents.UnitControlled]: [UnitControlledEvent, EventPriority];
  [SimEvents.UnitFreed]: [UnitFreedEvent, EventPriority];
  [SimEvents.SkillCopied]: [SkillCopiedEvent, EventPriority];
}

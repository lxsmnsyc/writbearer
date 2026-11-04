import type { EventMap } from '../core/event-engine';
import type { HitEventMap } from './events/hits';
import type { SkillEventMap } from './events/skills';
import type { StatusEventMap } from './events/statuses';
import type { LifeEventMap } from './events/life';

export type * from './events/hits';
export type * from './events/skills';
export type * from './events/statuses';
export type * from './events/life';

export const enum SimEvents {
  CheckHit = 'CheckHit',
  CheckTarget = 'CheckTarget',
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
  // After every unit has acted in a tick
  Tick = 'Tick',
  UnitRevived = 'UnitRevived',
  CheckChase = 'CheckChase',
  CheckProjectile = 'CheckProjectile',
  CheckSkillRank = 'CheckSkillRank',
  CheckAttackElements = 'CheckAttackElements',
  UnitRevealed = 'UnitRevealed',
}

/** Which event carries which shape, on which priority scale. Entries live in the group modules. */
export interface SimEventMap
  extends EventMap,
    HitEventMap,
    SkillEventMap,
    StatusEventMap,
    LifeEventMap {}

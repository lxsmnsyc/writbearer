import type { EventMap } from '../core/event-engine';
import type { HitEventMap } from './events/hits';
import type { SkillEventMap } from './events/skills';
import type { StatusEventMap } from './events/statuses';
import type { LifeEventMap } from './events/life';
import type { CorpseEventMap } from './events/cc-corpses';
import type { PossessEventMap } from './events/bp-possess';
import type { KnockbackEventMap } from './events/cc-knockback';
import type { LinkEventMap } from './events/bp-link';

export type * from './events/hits';
export type * from './events/skills';
export type * from './events/statuses';
export type * from './events/life';
export type * from './events/cc-corpses';
export type * from './events/bp-possess';
export type * from './events/cc-knockback';
export type * from './events/bp-link';

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
  UnitLaidToRest = 'UnitLaidToRest',
  UnitControlled = 'UnitControlled',
  UnitFreed = 'UnitFreed',
  SkillCopied = 'SkillCopied',
  CheckKnockback = 'CheckKnockback',
  LinkRisen = 'LinkRisen',
  LinkSwapped = 'LinkSwapped',
}

/** Which event carries which shape, on which priority scale. Entries live in the group modules. */
export interface SimEventMap
  extends
    EventMap,
    HitEventMap,
    SkillEventMap,
    StatusEventMap,
    LifeEventMap,
    CorpseEventMap,
    PossessEventMap,
    KnockbackEventMap,
    LinkEventMap {}

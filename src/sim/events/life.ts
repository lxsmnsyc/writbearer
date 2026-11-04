import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type { HealPriority, ValuePriority } from '../types';
import type Unit from '../unit';
import type { SimEvents } from '../events';

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

/** A hidden or disguised unit is revealed. */
export interface UnitRevealedEvent extends BaseEvent {
  source: Unit;
  by: Unit | null;
}

export interface UnitRevivedEvent extends BaseEvent {
  source: Unit;
}

export interface TickEvent extends BaseEvent {
  dt: number;
}

/** Asks how far from the bearer a merc may chase, in tiles. `value` starts at its orders' chase. */
export interface CheckChaseEvent extends BaseEvent {
  source: Unit;
  value: number;
}

export interface LifeEventMap {
  [SimEvents.UnitHeal]: [UnitHealEvent, HealPriority];
  [SimEvents.UnitDies]: [UnitDiesEvent, EventPriority];
  [SimEvents.Tick]: [TickEvent, EventPriority];
  [SimEvents.UnitRevived]: [UnitRevivedEvent, EventPriority];
  [SimEvents.CheckChase]: [CheckChaseEvent, ValuePriority];
  [SimEvents.UnitRevealed]: [UnitRevealedEvent, EventPriority];
}

import type { BaseEvent } from '../../core/event-emitter';
import type { ValuePriority } from '../types';
import type Unit from '../unit';
import type { SimEvents } from '../events';

/**
 * Asks whether a knockback happens and how far. `distance` starts at the
 * requested tiles; a listener can shorten it, or set `disabled` to stop it.
 */
export interface CheckKnockbackEvent extends BaseEvent {
  source: Unit;
  target: Unit;
  distance: number;
}

export interface KnockbackEventMap {
  [SimEvents.CheckKnockback]: [CheckKnockbackEvent, ValuePriority];
}

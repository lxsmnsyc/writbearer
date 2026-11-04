import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type Unit from '../unit';
import type { SimEvents } from '../events';

/** A corpse is laid to rest and can never be raised. `by` is who did it, if anyone. */
export interface UnitLaidToRestEvent extends BaseEvent {
  source: Unit;
  by: Unit | null;
}

export interface CorpseEventMap {
  [SimEvents.UnitLaidToRest]: [UnitLaidToRestEvent, EventPriority];
}

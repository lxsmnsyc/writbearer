import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type Unit from '../unit';
import type { SimEvents } from '../events';

/** A linked unit rises because the rest of its group outlived the window. */
export interface LinkRisenEvent extends BaseEvent {
  source: Unit;
}

/** Two linked units trade places. */
export interface LinkSwappedEvent extends BaseEvent {
  source: Unit;
  with: Unit;
}

export interface LinkEventMap {
  [SimEvents.LinkRisen]: [LinkRisenEvent, EventPriority];
  [SimEvents.LinkSwapped]: [LinkSwappedEvent, EventPriority];
}

import type { BaseEvent, EventPriority } from '../../core/event-emitter';
import type { ValuePriority } from '../types';
import type { ActiveStatus, StatusDef } from '../status';
import type Unit from '../unit';
import type { SimEvents } from '../events';

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

export interface StatusEventMap {
  [SimEvents.CheckBuildup]: [CheckBuildupEvent, ValuePriority];
  [SimEvents.CheckStatusDuration]: [CheckStatusDurationEvent, ValuePriority];
  [SimEvents.StatusApplied]: [StatusEvent, EventPriority];
  [SimEvents.StatusRemoved]: [StatusEvent, EventPriority];
}

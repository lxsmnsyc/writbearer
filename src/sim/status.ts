import type { Lifecycle } from '../core/lifecycle';
import type { Modifier } from './stats';
import type Unit from './unit';

/**
 * A kind of status, such as Stun or Burn. Statuses with a `threshold` come
 * from buildup: hits fill a bar, and the status triggers when it is full.
 */
export interface StatusDef {
  id: string;
  name: string;
  // Seconds, before `CheckStatusDuration`
  duration: number;
  // Seconds after it ends before the unit can get it again
  immunity: number;
  // Buildup the unit needs to get it. Statuses that are only given leave it out.
  threshold?: (unit: Unit) => number;
  // A stronger status it turns into when it triggers again while active,
  // as Chill turns into Freeze
  escalate?: StatusDef;
  // The unit cannot act: no moves, attacks or skills
  disables?: boolean;
  // Move speed is multiplied by this
  slow?: number;
  // The unit runs from the source and cannot fight, as with fear
  flees?: boolean;
  // Ends early when its source dies, as a taunt does
  endsWithSource?: boolean;
  // Stacks build with each new application, up to this many. Absent means one.
  maxStacks?: number;
  // Stat changes while active, from the stacks and the power it was given with
  modifiers?: (status: ActiveStatus) => Modifier[];
  // Runs every tick while active
  tick?: (status: ActiveStatus, dt: number) => void;
  // Listeners and changes that last while active
  setup?: (status: ActiveStatus) => Lifecycle;
}

/** A status on one unit. */
export interface ActiveStatus {
  def: StatusDef;
  unit: Unit;
  source: Unit;
  // Seconds left
  remaining: number;
  // Seconds since it began
  elapsed: number;
  stacks: number;
  // How strong it was made, such as the rank of the skill that gave it
  power: number;
  lifecycle: Lifecycle | null;
}

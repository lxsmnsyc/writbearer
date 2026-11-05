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
  // A timed gain that can be stolen, such as a Ward or a shield
  buff?: boolean;
  // Harmful even when its source stands on the unit's side, as mind control is
  hostile?: boolean;
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

/** The buffs on a unit: its active statuses whose kind is marked `buff`. */
export function buffsOf(unit: Unit): ActiveStatus[] {
  const out: ActiveStatus[] = [];
  for (const s of unit.statuses.values()) {
    if (s.def.buff === true) {
      out.push(s);
    }
  }
  return out;
}

/**
 * Moves the first buff of `from` to `thief`, with its time, power and stacks
 * left. Returns the thief's new status, or null if `from` had none or the
 * thief could not take it; then `from` keeps the buff.
 */
export function stealBuff(thief: Unit, from: Unit): ActiveStatus | null {
  const buff = buffsOf(from).at(0);
  if (!buff) {
    return null;
  }
  const taken = thief.addStatus(buff.def, thief, buff.remaining, buff.power);
  if (!taken) {
    return null;
  }
  const stacks = Math.min(buff.stacks, buff.def.maxStacks ?? 1);
  if (taken.stacks < stacks) {
    taken.stacks = stacks;
    if (buff.def.modifiers) {
      thief.recalc();
    }
  }
  from.removeStatus(buff.def.id);
  return taken;
}

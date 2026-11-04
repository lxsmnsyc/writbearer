import { type CheckBuildupEvent, type CheckStatusDurationEvent, SimEvents } from '../events';
import type { ActiveStatus, StatusDef } from '../status';
import type Unit from '../unit';

// Buildup starts to fade this long after the last hit, then fades this fast.
export const BUILDUP_HOLD = 2;
export const BUILDUP_DECAY = 15;

/**
 * Gives the unit a status, or refreshes it. Returns null if the unit is
 * immune or dead.
 */
export function addStatus(
  unit: Unit,
  def: StatusDef,
  source: Unit,
  duration = def.duration,
  power = 1,
): ActiveStatus | null {
  if (!unit.alive || (unit.immunity.get(def.id) ?? 0) > 0) {
    return null;
  }
  const check: CheckStatusDurationEvent = {
    id: 'CheckStatusDuration',
    disabled: false,
    source,
    target: unit,
    status: def,
    value: duration,
  };
  unit.sim.emit(SimEvents.CheckStatusDuration, check);
  if (check.disabled || check.value <= 0) {
    return null;
  }
  const current = unit.statuses.get(def.id);
  if (current) {
    current.remaining = Math.max(current.remaining, check.value);
    current.source = source;
    current.power = Math.max(current.power, power);
    if (current.stacks < (def.maxStacks ?? 1)) {
      current.stacks++;
      if (def.modifiers) {
        unit.recalc();
      }
    }
    return current;
  }
  const status: ActiveStatus = {
    def,
    unit,
    source,
    remaining: check.value,
    elapsed: 0,
    stacks: 1,
    power,
    lifecycle: null,
  };
  unit.statuses.set(def.id, status);
  if (def.modifiers) {
    unit.recalc();
  }
  status.lifecycle = def.setup?.(status) ?? null;
  status.lifecycle?.start();
  if (def.disables) {
    // A stunned unit loses the blow or skill it was winding up.
    unit.swing = -1;
    unit.swingTarget = null;
    unit.cast = null;
  }
  unit.sim.emit(SimEvents.StatusApplied, { id: 'StatusApplied', disabled: false, status });
  return status;
}

/** Ends a status early or on time. The unit is then immune to it for a while. */
export function removeStatus(unit: Unit, id: string): void {
  const status = unit.statuses.get(id);
  if (!status) {
    return;
  }
  unit.statuses.delete(id);
  if (status.def.modifiers) {
    unit.recalc();
  }
  status.lifecycle?.stop();
  if (status.def.immunity > 0) {
    unit.immunity.set(id, status.def.immunity);
  }
  unit.sim.emit(SimEvents.StatusRemoved, { id: 'StatusRemoved', disabled: false, status });
}

/**
 * Adds buildup toward a status. When it reaches the unit's threshold the
 * status triggers and the buildup resets.
 */
export function buildUp(unit: Unit, def: StatusDef, source: Unit, amount: number): void {
  const limit = def.threshold?.(unit);
  if (!unit.alive || limit === undefined || (unit.immunity.get(def.id) ?? 0) > 0) {
    return;
  }
  // A status in effect cannot build up again, unless it escalates.
  if (unit.statuses.has(def.id) && !def.escalate) {
    return;
  }
  const check: CheckBuildupEvent = {
    id: 'CheckBuildup',
    disabled: false,
    source,
    target: unit,
    status: def,
    value: amount,
  };
  unit.sim.emit(SimEvents.CheckBuildup, check);
  if (check.disabled || check.value <= 0) {
    return;
  }
  const total = (unit.buildup.get(def.id) ?? 0) + check.value;
  unit.buildupAt.set(def.id, unit.sim.time);
  if (total < limit) {
    unit.buildup.set(def.id, total);
    return;
  }
  unit.buildup.delete(def.id);
  if (def.escalate && unit.statuses.has(def.id)) {
    unit.removeStatus(def.id);
    unit.addStatus(def.escalate, source);
  } else {
    unit.addStatus(def, source);
  }
}

/** Runs statuses, immunity and buildup decay for one tick. */
export function tickStatuses(unit: Unit, dt: number): void {
  for (const [id, s] of unit.statuses) {
    s.elapsed += dt;
    s.def.tick?.(s, dt);
    s.remaining -= dt;
    if (s.remaining <= 0 || (s.def.endsWithSource && !s.source.alive)) {
      unit.removeStatus(id);
    }
  }
  for (const [id, left] of unit.immunity) {
    if (left <= dt) {
      unit.immunity.delete(id);
    } else {
      unit.immunity.set(id, left - dt);
    }
  }
  for (const [id, value] of unit.buildup) {
    if (unit.sim.time - (unit.buildupAt.get(id) ?? 0) < BUILDUP_HOLD) {
      continue;
    }
    const next = value - BUILDUP_DECAY * dt;
    if (next <= 0) {
      unit.buildup.delete(id);
    } else {
      unit.buildup.set(id, next);
    }
  }
}

/** Ends every status, as on death. No immunity follows. */
export function clearStatuses(unit: Unit): void {
  for (const s of unit.statuses.values()) {
    s.lifecycle?.stop();
  }
  unit.statuses.clear();
  unit.buildup.clear();
  unit.immunity.clear();
  unit.recalc();
}

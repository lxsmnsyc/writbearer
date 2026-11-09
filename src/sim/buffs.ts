import type { ActiveStatus, StatusDef } from './status';
import type Unit from './unit';

export interface BuffPartyOptions {
  // Only allies within this many tiles of the source. Absent means the whole side.
  radius?: number;
  // Whether the bearer takes it. Defaults to true.
  includeBearer?: boolean;
}

/**
 * Gives a buff to every living unit on the source's side, in range if a radius
 * is set. A unit that already has it gets its time refreshed, not a second
 * copy. Allies are not targeted, so no targeting check runs. Returns the
 * statuses given, one per unit that took it.
 */
export function buffParty(
  source: Unit,
  def: StatusDef,
  seconds: number,
  power = 1,
  opts: BuffPartyOptions = {},
): ActiveStatus[] {
  const sim = source.sim;
  const out: ActiveStatus[] = [];
  for (const u of sim.living(source.side)) {
    if (opts.radius !== undefined && source.distanceTo(u) > opts.radius) {
      continue;
    }
    if (opts.includeBearer === false && u === sim.bearer) {
      continue;
    }
    const taken = refreshBuff(u, source, def, seconds, power);
    if (taken) {
      out.push(taken);
    }
  }
  return out;
}

/**
 * Gives one unit a buff. When it is already on, its time and power rise to
 * the new ones if higher, and it does not stack.
 */
export function refreshBuff(
  unit: Unit,
  source: Unit,
  def: StatusDef,
  seconds: number,
  power = 1,
): ActiveStatus | null {
  const taken = unit.addStatus(def, source, seconds, power);
  if (taken && taken.stacks > 1) {
    // A buff refreshes; it never builds stacks.
    taken.stacks = 1;
    if (def.modifiers) {
      unit.recalc();
    }
  }
  return taken;
}

import { EventPriority } from '../core/event-emitter';
import type { Lifecycle } from '../core/lifecycle';
import { Hunt } from './ai';
import { TURNED_ID } from './ai/turned';
import { SimEvents } from './events';
import type Sim from './sim';
import type { ActiveStatus, StatusDef } from './status';
import { Rank, Side, ValuePriority } from './types';
import type Unit from './unit';

// How long a controlled merc fights for the monsters, in seconds.
export const CONTROL_TIME = 6;

/** What a merc was before it was taken, put back when the control ends. */
interface Taken {
  side: Side;
  hunt: Hunt | undefined;
  target: Unit | null;
  order: Unit['order'];
  aware: boolean;
}

const taken = new WeakMap<Unit, Taken>();
// Mercs that died under control: their side comes back after the death is told
const dying = new WeakSet<Unit>();

// Puts the merc back on its side with its hunt, order and target.
function release(unit: Unit): void {
  const was = taken.get(unit);
  if (!was) {
    return;
  }
  taken.delete(unit);
  unit.side = was.side;
  unit.hunt = was.hunt;
  unit.order = was.order;
  unit.aware = was.aware;
  unit.cast = null;
  unit.swing = -1;
  unit.swingTarget = null;
  // The old target comes back only if it is still a foe
  const back = was.target?.alive && unit.sim.foes(unit.side).includes(was.target);
  unit.target = back ? was.target : null;
  unit.sim.emit(SimEvents.UnitFreed, { id: 'UnitFreed', disabled: false, source: unit });
}

function hold(status: ActiveStatus): Lifecycle {
  const { unit } = status;
  return {
    start() {
      taken.set(unit, {
        side: unit.side,
        hunt: unit.hunt,
        target: unit.target,
        order: unit.order,
        aware: unit.aware,
      });
      unit.side = Side.Monster;
      unit.hunt = Hunt.Nearest;
      unit.target = null;
      unit.order = null;
      unit.aware = true;
      unit.cast = null;
      unit.swing = -1;
      unit.swingTarget = null;
      unit.sim.emit(SimEvents.UnitControlled, {
        id: 'UnitControlled',
        disabled: false,
        source: unit,
        by: status.source,
      });
    },
    stop() {
      // Death clears statuses before the death is told. The merc stays on the
      // monster side until then, so its fall moves no morale, and the game
      // sees a merc's death after the side is back.
      if (unit.alive) {
        release(unit);
      } else {
        dying.add(unit);
      }
    },
  };
}

/**
 * Mind control. The merc fights for the monsters until it ends. It no longer
 * counts as a party member (party wipe, morale, wages, experience), and
 * Cleanse lifts it. Ends early if its source dies.
 */
export const CONTROLLED: StatusDef = {
  id: 'controlled',
  name: 'Controlled',
  duration: CONTROL_TIME,
  immunity: 8,
  endsWithSource: true,
  hostile: true,
  setup: hold,
};

/**
 * Takes a merc for `seconds`. Returns the status, or null if the unit is the
 * bearer, is not a living merc, or is immune.
 */
export function control(by: Unit, merc: Unit, seconds = CONTROL_TIME): ActiveStatus | null {
  return merc.addStatus(CONTROLLED, by, seconds);
}

// How long a turned monster fights for the party, in seconds.
export const TURN_TIME = 10;

/** What a monster was before it was turned. */
interface Before {
  hunt: Hunt | undefined;
  target: Unit | null;
  aware: boolean;
}

const before = new WeakMap<Unit, Before>();
// Turned monsters that died while turned
const fallen = new WeakSet<Unit>();

// Puts the monster back on its side with its hunt and target.
function restore(unit: Unit): void {
  const was = before.get(unit);
  if (!was) {
    return;
  }
  before.delete(unit);
  unit.side = Side.Monster;
  unit.hunt = was.hunt;
  unit.aware = was.aware;
  unit.cast = null;
  unit.swing = -1;
  unit.swingTarget = null;
  // The old target comes back only if it is still a foe
  const back = was.target?.alive && unit.sim.foes(unit.side).includes(was.target);
  unit.target = back ? was.target : null;
  unit.sim.emit(SimEvents.UnitFreed, { id: 'UnitFreed', disabled: false, source: unit });
}

function turnHold(status: ActiveStatus): Lifecycle {
  const { unit } = status;
  return {
    start() {
      before.set(unit, { hunt: unit.hunt, target: unit.target, aware: unit.aware });
      unit.side = Side.Party;
      unit.hunt = Hunt.Nearest;
      unit.target = null;
      unit.aware = true;
      unit.cast = null;
      unit.swing = -1;
      unit.swingTarget = null;
      unit.sim.emit(SimEvents.UnitControlled, {
        id: 'UnitControlled',
        disabled: false,
        source: unit,
        by: status.source,
      });
    },
    stop() {
      // A turned monster that dies is a monster's corpse, not a merc's
      if (!unit.alive) {
        fallen.add(unit);
      }
      restore(unit);
    },
  };
}

/**
 * A monster taken for a while. It fights for the party, counts as no party
 * member and gives no kill credit or loot when it falls. Ends early if the
 * one who turned it dies.
 */
export const TURNED: StatusDef = {
  id: TURNED_ID,
  name: 'Turned',
  duration: TURN_TIME,
  immunity: 0,
  endsWithSource: true,
  hostile: true,
  setup: turnHold,
};

/**
 * Turns a normal monster to the party's side for `seconds`. Returns the
 * status, or null for a boss, an elite, a mini-boss, the bearer, a unit not
 * of the monsters, or one already turned.
 */
export function turn(
  sim: Sim,
  monster: Unit,
  seconds = TURN_TIME,
  by: Unit | null = sim.bearer,
): ActiveStatus | null {
  if (!by) {
    return null;
  }
  const { rank, named, still } = monster;
  if (monster === sim.bearer || monster.side !== Side.Monster || rank !== Rank.Normal) {
    return null;
  }
  if (named || still || monster.statuses.has(TURNED_ID)) {
    return null;
  }
  return monster.addStatus(TURNED, by, seconds);
}

/** Whether the unit is a monster turned to the party now. */
export function isTurned(unit: Unit): boolean {
  return unit.statuses.has(TURNED_ID);
}

/** Whether the unit died while turned: its death gives no credit or loot. */
export function fellTurned(unit: Unit): boolean {
  return fallen.has(unit);
}

/**
 * Ends control and turning on every unit, restoring side, orders and target.
 * Call it before anything that sorts units by side, such as a stage change
 * or a save.
 */
export function freeControlled(sim: Sim): void {
  for (const u of sim.units) {
    u.removeStatus(CONTROLLED.id);
    u.removeStatus(TURNED_ID);
  }
}

/** Whether the unit is under control now. */
export function isControlled(unit: Unit): boolean {
  return unit.statuses.has(CONTROLLED.id);
}

/** Registers the rules of control on a sim. */
export default function setupControl(sim: Sim): void {
  // Only a living merc of the party can be taken, never the bearer.
  sim.on(SimEvents.CheckStatusDuration, ValuePriority.Pre, (event) => {
    if (event.status !== CONTROLLED) {
      return;
    }
    const merc = event.target;
    if (merc === sim.bearer || merc.side !== Side.Party || !merc.alive) {
      event.disabled = true;
    }
  });
  // Runs after morale, which saw the dead merc as no ally, and before the
  // game's own listeners, which must see it on its old side.
  sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
    if (dying.delete(event.source)) {
      release(event.source);
    }
  });
}

import type Sim from '../sim';
import { allowed } from '../targeting';
import { Side } from '../types';
import type Unit from '../unit';
import { engage, nearest } from './common';

/** How far a turned monster strays from the one who turned it, in tiles. */
export const LEASH = 7;

/** The id of the status that marks a turned monster. */
export const TURNED_ID = 'turned';

// Uses a skill that costs no mana, on its own cooldown, whenever its rule says so.
function freeSkill(sim: Sim, u: Unit, target: Unit | null): boolean {
  for (const skill of u.skills) {
    if (skill.cost <= 0 && u.canCast(skill) && skill.wants(u, target, sim)) {
      if (u.startCast(skill, target)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * A turned monster's turn: it keeps near the one who turned it and fights
 * the nearest monster it may target. No belt, no orders, no spells that cost
 * mana.
 */
export default function thinkTurned(sim: Sim, u: Unit, dt: number): void {
  const owner = u.statuses.get(TURNED_ID)?.source;
  // Called back to the owner when it strays too far
  if (owner?.alive && u.distanceTo(owner) > LEASH) {
    u.target = null;
    u.travel(owner.x, owner.z, dt, LEASH * 0.5);
    return;
  }
  const foes = allowed(u, sim.foes(Side.Party));
  const target = nearest(u, foes);
  if (freeSkill(sim, u, target)) {
    return;
  }
  if (!target) {
    u.target = null;
    // Idle: stay by the owner
    if (owner?.alive && u.distanceTo(owner) > 2) {
      u.travel(owner.x, owner.z, dt, 1.5);
    }
    return;
  }
  engage(u, target, dt);
}

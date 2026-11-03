import { type CheckSkillRankEvent, SimEvents } from '../sim/events';
import { Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';

// First numbers for active skills. A starting point for balance, not final
// values. Every number that grows with rank says so in its skill's text.

export const isElite = (u: Unit): boolean => u.rank !== Rank.Normal;
// The rank a unit uses a skill at: the learned rank, at least 1 while it is
// being used, and what CheckSkillRank listeners add, such as a bonus rank.
export function rankOf(u: Unit, id: string): number {
  const check: CheckSkillRankEvent = {
    id: 'CheckSkillRank',
    disabled: false,
    source: u,
    skill: id,
    value: Math.max(1, u.skillRank(id)),
  };
  u.sim.emit(SimEvents.CheckSkillRank, check);
  return check.value;
}
export const inReach = (u: Unit, target: Unit | null): target is Unit =>
  target !== null && u.distanceTo(target) <= u.kit.reach;

export const PIERCE_WIDTH = 0.45;
// How far past the target the arrow keeps flying
export const PIERCE_OVERSHOOT = 2.5;

// Enemies the line from `u` through `target` would pass.
export function inLine(u: Unit, target: Unit): Unit[] {
  const dx = target.x - u.x;
  const dz = target.z - u.z;
  const d = Math.hypot(dx, dz) || 1;
  const length = u.kit.reach + PIERCE_OVERSHOOT;
  return u.sim.living(Side.Monster).filter((e) => {
    const along = ((e.x - u.x) * dx + (e.z - u.z) * dz) / d;
    const across = Math.abs(((e.x - u.x) * dz - (e.z - u.z) * dx) / d);
    return along > 0 && along <= length && across <= PIERCE_WIDTH;
  });
}

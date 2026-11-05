import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type Sim from './sim';
import type { Skill } from './skill';
import { Side, ValuePriority } from './types';
import type Unit from './unit';
import { effectiveRank } from './unit/casting';

/** A skill a merc released, and the rank it used it at. */
export interface Released {
  skill: Skill;
  rank: number;
}

const last = new WeakMap<Unit, Released>();
// The copy being cast: its caster, skill and the rank it must use
let copying: { by: Unit; skill: Skill; rank: number } | null = null;

/** The last skill a merc released, or null if it has released none. */
export function lastReleased(unit: Unit): Released | null {
  return last.get(unit) ?? null;
}

/**
 * `by` casts the last skill `from` released, at the rank `from` used it at,
 * with no mana and no cooldown. The skill goes through the release event, so
 * listeners see it. Returns false if `from` has released nothing.
 */
export function copySkill(by: Unit, from: Unit, target: Unit | null): boolean {
  const record = last.get(from);
  if (!record || !by.alive) {
    return false;
  }
  copying = { by, skill: record.skill, rank: record.rank };
  try {
    by.sim.emit(SimEvents.SkillCopied, {
      id: 'SkillCopied',
      disabled: false,
      source: by,
      from,
      skill: record.skill,
      rank: record.rank,
    });
    by.sim.emit(SimEvents.UnitSkillRelease, {
      id: 'UnitSkillRelease',
      disabled: false,
      source: by,
      skill: record.skill,
      target,
    });
  } finally {
    copying = null;
  }
  return true;
}

/** Registers the record of released skills and the rank override of a copy. */
export default function setupCopy(sim: Sim): void {
  // Mercs only: a copy is never recorded, and a monster's skills are its own.
  sim.on(SimEvents.UnitSkillRelease, EventPriority.Post, (event) => {
    const u = event.source;
    if (copying || u.side !== Side.Party) {
      return;
    }
    const check = {
      id: 'CheckSkillRank' as const,
      disabled: false,
      source: u,
      skill: event.skill.id,
      value: Math.max(1, effectiveRank(u, event.skill.id)),
    };
    sim.emit(SimEvents.CheckSkillRank, check);
    last.set(u, { skill: event.skill, rank: check.value });
  });
  // The copy uses the rank of the merc it came from, whatever the caster has.
  sim.on(SimEvents.CheckSkillRank, ValuePriority.Post, (event) => {
    if (copying && event.source === copying.by && event.skill === copying.skill.id) {
      event.value = copying.rank;
    }
  });
}

import { type CheckSkillCostEvent, SimEvents } from '../events';
import type { Skill } from '../skill';
import type Unit from '../unit';

/** Starts a basic attack. The blow lands later, on the hit frame. */
export function startAttack(unit: Unit, target: Unit): boolean {
  if (unit.busy || unit.cooldown > 0 || unit.kit.interval <= 0) {
    return false;
  }
  unit.swing = 0;
  unit.swingTarget = target;
  unit.cooldown = unit.kit.interval;
  unit.face(target);
  return true;
}

/** The mana a skill costs the unit now, after passives and items. */
export function skillCost(unit: Unit, skill: Skill): number {
  const event: CheckSkillCostEvent = {
    id: 'CheckSkillCost',
    disabled: false,
    source: unit,
    skill,
    value: skill.cost,
  };
  unit.sim.emit(SimEvents.CheckSkillCost, event);
  return Math.max(0, Math.round(event.value));
}

/** Whether the unit is free, the skill is off cooldown and the mana is there. */
export function canCast(unit: Unit, skill: Skill): boolean {
  return (
    unit.alive &&
    !unit.busy &&
    (unit.skillCooldowns.get(skill.id) ?? 0) <= 0 &&
    unit.mana >= unit.skillCost(skill)
  );
}

/** Starts a skill's windup. Returns false if it cannot be used now. */
export function startCast(unit: Unit, skill: Skill, target: Unit | null): boolean {
  if (!unit.canCast(skill)) {
    return false;
  }
  const event = {
    id: 'UnitSkillWindup',
    disabled: false,
    source: unit,
    skill,
    target,
  };
  unit.sim.emit(SimEvents.UnitSkillWindup, event);
  return !event.disabled;
}

/** The rank learned in a skill, or 0. Monster skills count as rank 1. */
export function skillRank(unit: Unit, id: string): number {
  return unit.skillRanks.get(id) ?? (unit.skills.some((s) => s.id === id) ? 1 : 0);
}

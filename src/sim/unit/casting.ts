import { type CheckSkillCostEvent, SimEvents } from '../events';
import type { Skill } from '../skill';
import { amountOf, spend } from '../resource';
import { MAX_RANK } from '../stats';
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
    unit.mana >= unit.skillCost(skill) &&
    (skill.spends === undefined || amountOf(unit, skill.spends.resource) >= skill.spends.cost)
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
  if (event.disabled) {
    return false;
  }
  // The resource is paid next to the mana
  if (skill.spends) {
    spend(unit, skill.spends.resource, skill.spends.cost);
  }
  return true;
}

/** The rank learned in a skill, or 0. Monster skills count as rank 1. */
export function skillRank(unit: Unit, id: string): number {
  return unit.skillRanks.get(id) ?? (unit.skills.some((s) => s.id === id) ? 1 : 0);
}

/** The rank gear adds to a spell the unit has, so that the sum stays within MAX_RANK. */
export function bonusRank(unit: Unit, id: string): number {
  const learned = skillRank(unit, id);
  if (learned <= 0) {
    return 0;
  }
  return effectiveRank(unit, id) - learned;
}

/** The learned rank plus gear, within 1 to MAX_RANK. 0 for a spell the unit lacks. */
export function effectiveRank(unit: Unit, id: string): number {
  const learned = skillRank(unit, id);
  if (learned <= 0) {
    return 0;
  }
  return Math.min(MAX_RANK, Math.max(1, learned + (unit.stats.spellRanks.get(id) ?? 0)));
}

import { affinity } from '../elements';
import { SimEvents, type UnitDamageEvent } from '../events';
import type Sim from '../sim';
import { type Bonuses, Category, bonusKey } from '../stats';
import { DamageFlags, DamageKind, DamagePriority } from '../types';

export const CRITICAL_MULTIPLIER = 1.4;

// Hard defense scales from rAthena renewal. The reduction never passes 90%.
const ARMOR_SCALE = 4000;
const RESISTANCE_SCALE = 1000;

function hardDefense(value: number, defense: number, scale: number): number {
  return (value * (scale + defense)) / (scale + defense * 10);
}

/**
 * The product of `1 + percent / 100` over each category. Bonuses within a
 * category were already added together.
 */
function categoryFactor(bonuses: Bonuses, keys: [Category, number][], sign: 1 | -1): number {
  let factor = 1;
  for (const [category, key] of keys) {
    const percent = bonuses.get(bonusKey(category, key)) ?? 0;
    factor *= Math.max(0, 1 + (sign * percent) / 100);
  }
  return factor;
}

const isTrue = (event: UnitDamageEvent): boolean => event.kind === DamageKind.True;

/**
 * Each step of `UnitDamage`, in rAthena renewal's order.
 */
export default function setupDamageMechanics(sim: Sim): void {
  // The base roll, from the combat stream.
  sim.on(SimEvents.UnitDamage, DamagePriority.Initial, (event) => {
    if (event.fixed !== undefined) {
      event.value = event.fixed;
      return;
    }
    const d = event.source.derived;
    event.value =
      event.kind === DamageKind.Magical
        ? sim.rng.int(d.matkMin, d.matkMax)
        : sim.rng.int(d.atkMin, d.atkMax);
  });

  sim.on(SimEvents.UnitDamage, DamagePriority.SkillRatio, (event) => {
    event.value = (event.value * event.ratio) / 100;
  });

  sim.on(SimEvents.UnitDamage, DamagePriority.SkillFlat, (event) => {
    event.value += event.flat;
  });

  // The attacker's bonus categories.
  sim.on(SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
    if (isTrue(event)) {
      return;
    }
    const { source, target } = event;
    event.value *= categoryFactor(
      source.stats.amplify,
      [
        [Category.Race, target.race],
        [Category.TargetElement, target.element],
        [Category.AttackElement, event.element],
        [Category.AttackRange, event.range],
        [Category.Rank, target.rank],
      ],
      1,
    );
  });

  sim.on(SimEvents.UnitDamage, DamagePriority.Defense, (event) => {
    if (isTrue(event)) {
      return;
    }
    const d = event.target.derived;
    const pierce = (event.flags & DamageFlags.Pierce) !== 0;
    if (event.kind === DamageKind.Physical) {
      if (!pierce) {
        event.value = hardDefense(event.value, d.armor, ARMOR_SCALE);
      }
      event.value -= d.softDef;
    } else {
      if (!pierce) {
        event.value = hardDefense(event.value, d.resistance, RESISTANCE_SCALE);
      }
      event.value -= d.softMdef;
    }
    event.value = Math.max(0, event.value);
  });

  sim.on(SimEvents.UnitDamage, DamagePriority.Affinity, (event) => {
    if (isTrue(event)) {
      return;
    }
    event.value *= affinity(event.element, event.target.element, event.target.elementLevel) / 100;
  });

  sim.on(SimEvents.UnitDamage, DamagePriority.Critical, (event) => {
    if (event.flags & DamageFlags.Critical) {
      event.value *= CRITICAL_MULTIPLIER;
    }
  });

  // The target's reduction categories.
  sim.on(SimEvents.UnitDamage, DamagePriority.Reduce, (event) => {
    if (isTrue(event)) {
      return;
    }
    const { source } = event;
    event.value *= categoryFactor(
      event.target.stats.reduce,
      [
        [Category.Race, source.race],
        [Category.AttackElement, event.element],
        [Category.AttackRange, event.range],
        [Category.Rank, source.rank],
        [Category.Kind, event.kind],
      ],
      -1,
    );
  });

  // Shields block physical hits from the front.
  sim.on(SimEvents.UnitDamage, DamagePriority.Block, (event) => {
    const d = event.target.derived;
    if (
      event.kind !== DamageKind.Physical ||
      event.flags & DamageFlags.Flank ||
      d.blockChance <= 0
    ) {
      return;
    }
    if (sim.rng.random() * 100 < d.blockChance) {
      event.value *= 1 - Math.min(100, d.blockAmount) / 100;
      event.flags |= DamageFlags.Blocked;
    }
  });

  // Ward absorbs magical damage first.
  sim.on(SimEvents.UnitDamage, DamagePriority.Barrier, (event) => {
    const { target } = event;
    if (event.kind !== DamageKind.Magical || target.ward <= 0) {
      return;
    }
    const absorbed = Math.min(target.ward, event.value);
    target.ward -= absorbed;
    event.value -= absorbed;
  });

  sim.on(SimEvents.UnitDamage, DamagePriority.Exact, (event) => {
    const { target } = event;
    if (!target.alive) {
      event.value = 0;
      return;
    }
    let value = Math.max(0, Math.floor(event.value));
    if (event.flags & DamageFlags.NonLethal) {
      value = Math.min(value, Math.max(0, target.hp - 1));
    }
    target.hp -= value;
    event.value = value;
    if (target.hp <= 0) {
      target.hp = 0;
      target.lastBlow = { value, flags: event.flags };
      target.die(event.source);
    }
  });
}

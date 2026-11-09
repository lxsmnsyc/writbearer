import { describe, expect, it } from 'vitest';
import { spawnMerc } from '../../src/content/roster';
import { CHALLENGE } from '../../src/content/vanguard';
import {
  type ResourceDef,
  amountOf,
  gain,
  grant,
  resourcesOf,
  spend,
} from '../../src/sim/resource';
import Sim from '../../src/sim/sim';
import type { Skill } from '../../src/sim/skill';
import type Unit from '../../src/sim/unit';

const SPHERES: ResourceDef = { id: 'spheres', name: 'Spheres', max: 3, start: 1 };

// A skill that costs 2 spheres and no mana
const BURST: Skill = {
  ...CHALLENGE,
  id: 'burst',
  cost: 0,
  spends: { resource: 'spheres', cost: 2 },
};

function setup(def: ResourceDef = SPHERES): { sim: Sim; unit: Unit } {
  const sim = new Sim(1);
  const unit = spawnMerc(sim, 'vanguard', 5, 0, 0);
  grant(unit, def);
  return { sim, unit };
}

describe('resource', () => {
  it('starts at its start amount and gain caps at max', () => {
    const { unit } = setup();
    expect(amountOf(unit, 'spheres')).toBe(1);
    expect(gain(unit, 'spheres', 10)).toBe(2);
    expect(amountOf(unit, 'spheres')).toBe(3);
  });

  it('fails a spend that is short and leaves the value', () => {
    const { unit } = setup();
    expect(spend(unit, 'spheres', 2)).toBe(false);
    expect(amountOf(unit, 'spheres')).toBe(1);
    expect(spend(unit, 'spheres', 1)).toBe(true);
    expect(amountOf(unit, 'spheres')).toBe(0);
  });

  it('decays each second', () => {
    const { sim, unit } = setup({ ...SPHERES, start: 3, decayPerSecond: 0.5 });
    sim.run(2);
    expect(amountOf(unit, 'spheres')).toBeCloseTo(2, 1);
  });

  it('resets on an area change unless kept', () => {
    const { sim, unit } = setup();
    grant(unit, { id: 'rage', name: 'Rage', max: 5, start: 0, keepAcrossAreas: true });
    gain(unit, 'spheres', 2);
    gain(unit, 'rage', 4);
    sim.area++;
    sim.run(0.1);
    expect(amountOf(unit, 'spheres')).toBe(1);
    expect(amountOf(unit, 'rage')).toBe(4);
  });

  it('gates a skill on the resource and spends it on cast', () => {
    const { unit } = setup();
    expect(unit.canCast(BURST)).toBe(false);
    gain(unit, 'spheres', 1);
    expect(unit.canCast(BURST)).toBe(true);
    expect(unit.startCast(BURST, null)).toBe(true);
    expect(amountOf(unit, 'spheres')).toBe(0);
    unit.skillCooldowns.clear();
    unit.cast = null;
    expect(unit.canCast(BURST)).toBe(false);
    gain(unit, 'spheres', 2);
    expect(unit.canCast(BURST)).toBe(true);
  });

  it('keeps the amount when a rank raise reruns setup', () => {
    const { unit } = setup();
    gain(unit, 'spheres', 1);
    grant(unit, SPHERES);
    expect(amountOf(unit, 'spheres')).toBe(2);
  });

  it('leaves a unit with no resources unchanged', () => {
    const sim = new Sim(1);
    const unit = spawnMerc(sim, 'vanguard', 5, 0, 0);
    expect(resourcesOf(unit)).toEqual([]);
    expect(amountOf(unit, 'spheres')).toBe(0);
    expect(unit.canCast(CHALLENGE)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import { buffParty } from '../../src/sim/buffs';
import { ENDOWED, endow, endowment } from '../../src/sim/endow';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { type StatusDef, buffsOf, stealBuff } from '../../src/sim/status';
import { Element, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const CHEER: StatusDef = { id: 'cheer', name: 'Cheer', duration: 5, immunity: 0, buff: true };

// A Vanguard source with an ally near, an ally far, a dead ally and a foe.
function scene(): { sim: Sim; source: Unit; near: Unit; far: Unit; dead: Unit; foe: Unit } {
  const sim = new Sim(1);
  // Every blow lands, so a hit never comes back null.
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
  const source = spawnMerc(sim, 'vanguard', 5, 0, 0);
  const near = spawnMerc(sim, 'ranger', 5, 2, 0);
  const far = spawnMerc(sim, 'cleric', 5, 20, 0);
  const dead = spawnMerc(sim, 'cleric', 5, 1, 1);
  dead.alive = false;
  const foe = spawnMonster(sim, 'hollowSoldier', 4, 30, 0);
  return { sim, source, near, far, dead, foe };
}

describe('buffParty', () => {
  it('reaches every living ally in range and none out of range, dead or foe', () => {
    const { source, near, far, dead, foe } = scene();
    const got = buffParty(source, CHEER, 5, 1, { radius: 6 });
    expect(got.map((s) => s.unit)).toHaveLength(2);
    expect(got.map((s) => s.unit)).toContain(source);
    expect(got.map((s) => s.unit)).toContain(near);
    expect(far.statuses.has('cheer')).toBe(false);
    expect(dead.statuses.has('cheer')).toBe(false);
    expect(foe.statuses.has('cheer')).toBe(false);
  });

  it('reaches the whole side without a radius, and can leave the bearer out', () => {
    const { sim, source, near, far } = scene();
    sim.bearer = near;
    expect(buffParty(source, CHEER, 5, 1, { includeBearer: false })).toHaveLength(2);
    expect(near.statuses.has('cheer')).toBe(false);
    expect(far.statuses.has('cheer')).toBe(true);
  });

  it('refreshes the time and keeps one status', () => {
    const { sim, source, near } = scene();
    buffParty(source, CHEER, 5);
    sim.run(3);
    expect(near.statuses.get('cheer')!.remaining).toBeLessThan(3);
    buffParty(source, CHEER, 5);
    expect(near.statuses.get('cheer')!.remaining).toBe(5);
    expect(near.statuses.get('cheer')!.stacks).toBe(1);
    expect(buffsOf(near)).toHaveLength(1);
  });

  it('does not reach a unit added later', () => {
    const { sim, source } = scene();
    buffParty(source, CHEER, 5);
    const late = spawnMerc(sim, 'ranger', 5, 3, 0);
    expect(late.statuses.has('cheer')).toBe(false);
  });
});

describe('endow', () => {
  function damageElement(attacker: Unit, target: Unit, element?: Element): Element {
    const event = attacker.hit(target, element === undefined ? {} : { element });
    return event!.element;
  }

  it('changes the hit element, and expiry restores the old one', () => {
    const { sim, near, foe } = scene();
    const own = near.attackElement;
    expect(endow(near, Element.Fire, 4)).toBe(true);
    expect(endowment(near)).toBe(Element.Fire);
    expect(damageElement(near, foe)).toBe(Element.Fire);
    sim.run(5);
    expect(near.statuses.has(ENDOWED.id)).toBe(false);
    expect(near.attackElement).toBe(own);
    expect(damageElement(near, foe)).toBe(own);
  });

  it('leaves skill elements that are set explicitly', () => {
    const { near, foe } = scene();
    endow(near, Element.Fire, 4);
    expect(damageElement(near, foe, Element.Frost)).toBe(Element.Frost);
  });

  it('a second endow replaces the first and expiry restores the original', () => {
    const { sim, near, foe } = scene();
    const own = near.attackElement;
    endow(near, Element.Fire, 4);
    endow(near, Element.Frost, 8);
    expect(damageElement(near, foe)).toBe(Element.Frost);
    expect(near.statuses.size).toBe(1);
    sim.run(9);
    expect(near.attackElement).toBe(own);
  });

  it('shows in the weakness pick of the AI event', () => {
    const { sim, near } = scene();
    endow(near, Element.Storm, 4);
    const check = {
      id: 'CheckAttackElements' as const,
      disabled: false,
      source: near,
      elements: [near.attackElement],
    };
    sim.emit(SimEvents.CheckAttackElements, check);
    expect(check.elements).toEqual([Element.Storm]);
  });

  it('can be stolen, and the thief hits with it', () => {
    const { near, foe } = scene();
    const own = foe.attackElement;
    endow(near, Element.Fire, 4);
    const got = stealBuff(foe, near);
    expect(got?.def).toBe(ENDOWED);
    expect(damageElement(foe, near)).toBe(Element.Fire);
    expect(near.statuses.has(ENDOWED.id)).toBe(false);
    foe.removeStatus(ENDOWED.id);
    expect(foe.attackElement).toBe(own);
  });

  it('is given to the party with buffParty and survives a recalc', () => {
    const { source, near } = scene();
    buffParty(source, ENDOWED, 6, Element.Earth + 1);
    expect(near.attackElement).toBe(Element.Earth);
    near.recalc();
    expect(near.attackElement).toBe(Element.Earth);
  });
});

import { describe, expect, it } from 'vitest';
import { BESTIARY } from '../../src/content/bestiary';
import { CARD_BY_MONSTER } from '../../src/content/cards';
import { MONSTERS, spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { MONSTER_ORDER } from '../../src/game/compendium';
import { FACTIONS } from '../../src/gen/stage/packs';
import { isKind } from '../../src/render/rig';
import { Hunt } from '../../src/sim/ai';
import { affinity } from '../../src/sim/elements';
import Sim from '../../src/sim/sim';
import { DREAD, FREEZE, STUN } from '../../src/sim/statuses';
import { isSteadfast } from '../../src/sim/steadfast';
import { DamageKind, Element } from '../../src/sim/types';

const DT = 0.05;
const GUARD = ['revenantKnight', 'gildedEffigy'] as const;

function world(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
  return sim;
}

describe('the Revenant Knight', () => {
  it('takes the Spectral 2 share of a Neutral hit, and a Fire hit in full', () => {
    const sim = world();
    spawnBearer(sim, 50, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const knight = spawnMonster(sim, 'revenantKnight', 4, 14, 10);
    expect(knight.element).toBe(Element.Spectral);
    expect(knight.elementLevel).toBe(2);
    const hitWith = (element: Element): number =>
      merc.hit(knight, { kind: DamageKind.Magical, element, fixed: 100 })?.value ?? 0;
    const spectral = hitWith(Element.Neutral);
    const fire = hitWith(Element.Fire);
    // The same unit with the element off takes the plain hit
    knight.element = Element.Neutral;
    const plain = hitWith(Element.Neutral);
    expect(spectral / plain).toBeCloseTo(affinity(Element.Neutral, Element.Spectral, 2) / 100, 2);
    expect(spectral).toBeLessThan(plain);
    expect(fire).toBe(plain);
  });
});

describe('the Gilded Effigy', () => {
  it('takes no Stun and no Dread, but a Soldier does; Freeze still holds it', () => {
    const sim = world();
    const bearer = spawnBearer(sim, 50, 30);
    const effigy = spawnMonster(sim, 'gildedEffigy', 4, 14, 10);
    const soldier = spawnMonster(sim, 'hollowSoldier', 4, 16, 10);
    expect(isSteadfast(effigy)).toBe(true);
    expect(isSteadfast(soldier)).toBe(false);
    for (const u of [effigy, soldier]) {
      u.addStatus(STUN, bearer);
      u.addStatus(DREAD, bearer);
    }
    expect(effigy.statuses.has(STUN.id)).toBe(false);
    expect(effigy.statuses.has(DREAD.id)).toBe(false);
    expect(soldier.statuses.has(STUN.id)).toBe(true);
    expect(soldier.statuses.has(DREAD.id)).toBe(true);
    effigy.addStatus(FREEZE, bearer);
    expect(effigy.statuses.has(FREEZE.id)).toBe(true);
  });

  it('stays still with the bearer at 4 tiles and wakes at 2', () => {
    const sim = world();
    const bearer = spawnBearer(sim, 34, 20);
    const effigy = spawnMonster(sim, 'gildedEffigy', 4, 30, 20);
    expect(effigy.hunt).toBe(Hunt.Nearest);
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    expect(effigy.aware).toBe(false);
    expect(effigy.x).toBe(30);
    bearer.x = 32;
    sim.tick(DT);
    expect(effigy.aware).toBe(true);
  });
});

describe('the guard monsters', () => {
  it.each(GUARD)('%s spawns and has a card, a bestiary entry, a slot and a figure', (kind) => {
    const sim = world();
    const unit = spawnMonster(sim, kind, 4, 10, 10);
    expect(unit.kind).toBe(kind);
    expect(MONSTERS[kind]).toBeDefined();
    expect(CARD_BY_MONSTER[kind]).toBeDefined();
    expect(BESTIARY[kind].who.length).toBeGreaterThan(0);
    expect(MONSTER_ORDER).toContain(kind);
    expect(isKind(kind)).toBe(true);
    expect(FACTIONS.some((f) => f.layer === 3 && f.kinds.includes(kind))).toBe(true);
  });
});

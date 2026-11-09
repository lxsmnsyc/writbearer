import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import { affinity } from '../../src/sim/elements';
import Sim from '../../src/sim/sim';
import { UNMOORED } from '../../src/sim/spectral';
import { ELEMENT_STATUS } from '../../src/sim/statuses';
import { DamageKind, Element } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function setup(): { sim: Sim; merc: Unit; target: Unit } {
  const sim = new Sim(1);
  const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
  const target = spawnMonster(sim, 'hollowSoldier', 4, 30, 0);
  target.derived.maxHp = 1e6;
  target.hp = 1e6;
  return { sim, merc, target };
}

// Damage one magical hit of an element deals to a target of a defense element
function damage(attack: Element, defense: Element): number {
  const { merc, target } = setup();
  target.element = defense;
  target.elementLevel = 1;
  const event = merc.hit(target, { kind: DamageKind.Magical, element: attack, ratio: 300 });
  return event?.value ?? 0;
}

describe('Spectral status', () => {
  it('ELEMENT_STATUS maps Spectral to Unmoored', () => {
    expect(ELEMENT_STATUS[Element.Spectral]).toBe(UNMOORED);
  });

  it('a Spectral hit builds buildup and triggers at the threshold', () => {
    const { merc, target } = setup();
    merc.hit(target, { kind: DamageKind.Magical, element: Element.Spectral, ratio: 300 });
    expect(target.buildup.get(UNMOORED.id) ?? 0).toBeGreaterThan(0);
    expect(target.statuses.has(UNMOORED.id)).toBe(false);
    target.buildUp(UNMOORED, merc, 1e6);
    expect(target.statuses.has(UNMOORED.id)).toBe(true);
  });

  it('enough Spectral hits trigger it', () => {
    const { merc, target } = setup();
    for (let i = 0; i < 200 && !target.statuses.has(UNMOORED.id); i++) {
      merc.hit(target, { kind: DamageKind.Magical, element: Element.Spectral, ratio: 300 });
    }
    expect(target.statuses.has(UNMOORED.id)).toBe(true);
  });

  it('a Neutral hit builds no Unmoored', () => {
    const { merc, target } = setup();
    for (let i = 0; i < 20; i++) {
      merc.hit(target, { kind: DamageKind.Magical, element: Element.Neutral, ratio: 300 });
    }
    expect(target.buildup.get(UNMOORED.id) ?? 0).toBe(0);
    expect(target.statuses.has(UNMOORED.id)).toBe(false);
  });

  it('Unmoored lowers armor and resistance without changing the element', () => {
    const { merc, target } = setup();
    const { armor, resistance } = target.derived;
    const element = target.element;
    target.addStatus(UNMOORED, merc);
    expect(target.derived.armor).toBeLessThan(armor);
    expect(target.derived.resistance).toBeLessThanOrEqual(resistance);
    expect(target.element).toBe(element);
    target.removeStatus(UNMOORED.id);
    expect(target.derived.armor).toBe(armor);
  });
});

describe('Spectral attacks', () => {
  it('deals 125% to a Spectral 1 target against 90% to Neutral (the table)', () => {
    expect(affinity(Element.Spectral, Element.Spectral, 1)).toBe(125);
    expect(affinity(Element.Spectral, Element.Neutral, 1)).toBe(90);
    const neutral = damage(Element.Spectral, Element.Neutral);
    const spectral = damage(Element.Spectral, Element.Spectral);
    expect(neutral).toBeGreaterThan(0);
    expect(spectral / neutral).toBeCloseTo(125 / 90, 1);
  });

  it('a Neutral attacker deals 90% to Spectral 1', () => {
    const base = damage(Element.Neutral, Element.Neutral);
    const spectral = damage(Element.Neutral, Element.Spectral);
    expect(spectral / base).toBeCloseTo(0.9, 1);
  });

  it('a merc with attackElement Spectral hits as Spectral by default', () => {
    const { merc, target } = setup();
    merc.attackElement = Element.Spectral;
    const event = merc.hit(target, { kind: DamageKind.Magical, ratio: 300 });
    expect(event?.element).toBe(Element.Spectral);
  });
});

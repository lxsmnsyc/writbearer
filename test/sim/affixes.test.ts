import { describe, expect, it } from 'vitest';
import { affixesOf, giveAffixes } from '../../src/content/affixes';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { generateStage, rollAffixes } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind, Element, Range, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function arena(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

const strike = (from: Unit, to: Unit, value: number): void => {
  from.hit(to, { kind: DamageKind.True, fixed: value, flags: 0 });
};

describe('elite affixes', () => {
  it('are rolled for every elite, more of them deeper down, Bound only for a pack', () => {
    const rng = new RNG(1);
    expect(rollAffixes(rng, 0, 5)).toHaveLength(1);
    expect(rollAffixes(rng, 1, 5)).toHaveLength(2);
    expect(rollAffixes(rng, 3, 5)).toHaveLength(3);
    for (let i = 0; i < 50; i++) {
      expect(rollAffixes(rng, 3, 1)).not.toContain('bound');
    }
    for (let seed = 1; seed <= 6; seed++) {
      const s = generateStage(new RNG(seed), 12, {
        kind: 'elite',
        ahead: ['combat'],
        objective: 'hunt',
      });
      for (const p of s.packs.filter((q) => q.elite >= 0)) {
        expect(p.affixes?.length).toBe(2);
      }
    }
  });

  it('share the first with the pack at half strength, if it is one they can share', () => {
    const sim = arena();
    const elite = spawnMonster(sim, 'hollowSoldier', 8, 10, 10, { elite: true });
    const mate = spawnMonster(sim, 'husk', 8, 11, 10);
    const pace = mate.kit.moveSpeed;
    giveAffixes(sim, elite, [mate], ['swift', 'might']);
    expect(affixesOf(sim).of(elite)).toEqual(['swift', 'might']);
    expect(affixesOf(sim).of(mate)).toEqual(['swift']);
    expect(mate.kit.moveSpeed).toBeCloseTo(pace * 1.15);
  });

  it('Stoneskin adds armor, and the Enchanted turn its hits to their element', () => {
    const sim = arena();
    const u = spawnMonster(sim, 'husk', 8, 10, 10);
    const armor = u.derived.armor;
    affixesOf(sim).give(u, 'stoneskin');
    affixesOf(sim).give(u, 'frostEnchanted');
    expect(u.derived.armor).toBeGreaterThan(armor);
    expect(u.attackElement).toBe(Element.Frost);
  });

  it('Vampiric heals from what it deals, and Thorns throws back melee damage', () => {
    const sim = arena();
    const vamp = spawnMonster(sim, 'husk', 8, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 8, 11, 10);
    affixesOf(sim).give(vamp, 'vampiric');
    vamp.hp = 10;
    strike(vamp, merc, 40);
    expect(vamp.hp).toBeGreaterThan(10);
    const thorny = spawnMonster(sim, 'husk', 8, 20, 20);
    affixesOf(sim).give(thorny, 'thorns');
    const hp = merc.hp;
    merc.hit(thorny, { kind: DamageKind.Physical, range: Range.Melee, flags: 0, fixed: 40 });
    expect(merc.hp).toBeLessThan(hp);
  });

  it('Warded takes magic first, and refills after a while unhit, unless kept from it', () => {
    const sim = arena();
    const u = spawnMonster(sim, 'penitent', 8, 10, 10);
    const run = affixesOf(sim);
    run.give(u, 'warded');
    const { most } = run.wardOf(u);
    const hp = u.hp;
    u.hit(u, {
      kind: DamageKind.Magical,
      fixed: Math.round(most / 2),
      flags: DamageFlags.Redirected,
    });
    expect(u.hp).toBe(hp);
    expect(run.wardOf(u).ward).toBeLessThan(most);
    let kept = false;
    run.keepWard(u, () => kept);
    for (let t = 0; t < 5; t += 0.05) {
      run.update(0.05);
    }
    expect(run.wardOf(u).ward).toBeLessThan(most);
    kept = true;
    run.update(0.05);
    expect(run.wardOf(u).ward).toBe(most);
  });

  it('Bound shares a hit among the group', () => {
    const sim = arena();
    const a = spawnMonster(sim, 'husk', 8, 10, 10);
    const b = spawnMonster(sim, 'husk', 8, 11, 10);
    const c = spawnMonster(sim, 'husk', 8, 12, 10);
    affixesOf(sim).bind([a, b, c]);
    const full = a.hp;
    const merc = spawnMerc(sim, 'vanguard', 8, 9, 10);
    strike(merc, a, 30);
    for (const u of [a, b, c]) {
      expect(full - u.hp).toBeGreaterThan(5);
      expect(full - u.hp).toBeLessThan(15);
    }
  });

  it('Might strengthens the pack near it while it lives, and Mending heals it', () => {
    const sim = arena();
    const lead = spawnMonster(sim, 'penitent', 8, 10, 10);
    const near = spawnMonster(sim, 'husk', 8, 12, 10);
    const far = spawnMonster(sim, 'husk', 8, 30, 30);
    const run = affixesOf(sim);
    const atk = near.derived.atkMax;
    run.give(lead, 'might');
    run.give(lead, 'mending');
    near.hp = 10;
    run.update(1);
    expect(near.derived.atkMax).toBeGreaterThan(atk);
    expect(far.derived.atkMax).toBe(atk);
    expect(near.hp).toBeGreaterThan(10);
    lead.hit(lead, {
      kind: DamageKind.True,
      fixed: lead.derived.maxHp * 2,
      flags: DamageFlags.Redirected,
    });
    expect(near.derived.atkMax).toBe(atk);
  });

  it('Herald wakes the next pack in the area and sends it to the fight', () => {
    const sim = arena();
    const herald = spawnMonster(sim, 'penitent', 8, 10, 10);
    herald.aware = true;
    const next = [spawnMonster(sim, 'husk', 8, 25, 25), spawnMonster(sim, 'husk', 8, 26, 25)];
    const farther = spawnMonster(sim, 'husk', 8, 38, 2);
    affixesOf(sim).give(herald, 'herald');
    for (let t = 0; t < 10.1; t += 0.05) {
      affixesOf(sim).update(0.05);
    }
    expect(next.every((u) => u.aware)).toBe(true);
    expect(next[0].lastSeen).toEqual({ x: herald.x, z: herald.z });
    expect(farther.aware).toBe(false);
  });

  it('Fire Enchanted bursts as it dies, shown first, sparing monsters', () => {
    const sim = arena();
    const u = spawnMonster(sim, 'husk', 8, 10, 10);
    affixesOf(sim).give(u, 'fireEnchanted');
    u.hit(u, { kind: DamageKind.True, fixed: u.derived.maxHp * 2, flags: DamageFlags.Redirected });
    expect(sim.warnings).toHaveLength(1);
    expect(sim.warnings[0].spare).toBe(Side.Monster);
  });
});

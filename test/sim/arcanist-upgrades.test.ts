import { describe, expect, it, vi } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import { FIREBALL, NOVA_RADIUS, fireboltBurn } from '../../src/content/jobs/arcanist/spells';
import ARCANIST_UPGRADES, { RIMED, SHARD_SLOW } from '../../src/content/jobs/arcanist/upgrades';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { type Upgrade, isBuilt } from '../../src/sim/builds';
import { SimEvents } from '../../src/sim/events';
import { effectiveDiscipline } from '../../src/sim/morale';
import Sim from '../../src/sim/sim';
import { type Skill, SkillMode } from '../../src/sim/skill';
import { BURN, FREEZE } from '../../src/sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { withUpgrade } from '../support/build';

// The Arcanist's 12 elite upgrades.

const SPELLS = ['frostNova', 'fireball', 'frostShard', 'firebolt'];

const upgrade = (id: string): Upgrade => {
  const found = ARCANIST_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// Every blow lands.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// Orders with every spell off, so only casts a test starts happen
const quiet = (): Toggles => {
  const skills: Toggles['skills'] = {};
  for (const id of SPELLS) {
    skills[id] = SkillMode.Off;
  }
  return { ...DEFAULT_TOGGLES, skills };
};

// An Arcanist with an upgrade, next to the bearer
function arcanistWith(id: string, level = 10): { sim: Sim; arcanist: Unit } {
  const sim = new Sim(3);
  alwaysHit(sim);
  spawnBearer(sim, 0, 0);
  const arcanist = spawnMerc(sim, 'arcanist', level, 1, 0, quiet());
  // No basic attacks, so only the upgrades hurt
  arcanist.kit.interval = 0;
  arcanist.mana = arcanist.derived.maxMana;
  withUpgrade(arcanist, upgrade(id));
  return { sim, arcanist };
}

// A still, awake, tough soldier
function foe(sim: Sim, x: number, z: number): Unit {
  const m = spawnMonster(sim, 'hollowSoldier', 3, x, z);
  m.aware = true;
  m.kit.moveSpeed = 0;
  m.kit.interval = 99;
  m.derived.maxHp = 100000;
  m.hp = 100000;
  return m;
}

// The spell as the unit casts it, with its upgrade
function spell(u: Unit, id: string): Skill {
  const found = u.skills.find((s) => s.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
}

const lost = (u: Unit): number => u.derived.maxHp - u.hp;

describe('the Arcanist upgrades', () => {
  it('has 12, three per spell, each with a patch or an effect', () => {
    const { upgrades, spells } = JOBS.arcanist;
    expect(upgrades).toHaveLength(12);
    for (const s of spells) {
      expect(upgrades.filter((u) => u.spell === s.id)).toHaveLength(3);
    }
    for (const u of upgrades) {
      expect(isBuilt(u)).toBe(true);
      expect(u.describe(5).length).toBeGreaterThan(10);
    }
  });
});

describe('Frost Nova upgrades', () => {
  it('Glacial Wall blocks the path between the bearer and the enemies, then opens', () => {
    const { sim, arcanist } = arcanistWith('glacialWall');
    sim.setWorld([{ x0: 0, z0: 0, x1: 20, z1: 6 }]);
    const enemy = foe(sim, 9.5, 3);
    arcanist.x = 1;
    arcanist.z = 3;
    sim.bearer!.x = 3;
    sim.bearer!.z = 3;
    const nova = spell(arcanist, 'frostNova');
    expect(nova.wants(arcanist, null, sim)).toBe(true);
    nova.release(arcanist, null, sim);
    // Two tiles toward the enemy from the bearer
    expect(sim.nav!.shut(5.5, 3.5)).toBe(true);
    expect(sim.nav!.shut(5.5, 1.5)).toBe(true);
    expect(sim.nav!.shut(2.5, 3.5)).toBe(false);
    // It deals no damage, and it is raised once at a time
    expect(lost(enemy)).toBe(0);
    expect(nova.wants(arcanist, null, sim)).toBe(false);
    sim.run(4 + 0.5 * 10 + 0.5);
    expect(sim.nav!.shut(5.5, 3.5)).toBe(false);
    expect(sim.zones).toHaveLength(0);
  });

  it('Glacial Wall is not wanted with no enemy near the bearer', () => {
    const { sim, arcanist } = arcanistWith('glacialWall');
    foe(sim, 30, 0).aware = false;
    expect(spell(arcanist, 'frostNova').wants(arcanist, null, sim)).toBe(false);
  });

  it('Rimefield slows enemies in the ring for 5 seconds', () => {
    const { sim, arcanist } = arcanistWith('rimefield');
    const inside = foe(sim, 1 + NOVA_RADIUS - 0.5, 0);
    const outside = foe(sim, 1 + NOVA_RADIUS + 3, 0);
    spell(arcanist, 'frostNova').release(arcanist, null, sim);
    expect(lost(inside)).toBeGreaterThan(0);
    sim.run(1);
    expect(inside.statuses.has(RIMED.id)).toBe(true);
    expect(inside.speed).toBeCloseTo(inside.kit.moveSpeed * inside.burden * 0.6 * 1, 5);
    expect(outside.statuses.has(RIMED.id)).toBe(false);
    sim.run(5);
    expect(sim.zones).toHaveLength(0);
    expect(inside.statuses.has(RIMED.id)).toBe(false);
  });

  it('Cold Snap fires the nova free when an enemy first touches the Arcanist, every 12 seconds', () => {
    const { sim, arcanist } = arcanistWith('coldSnap');
    const enemy = foe(sim, 8, 0);
    sim.run(0.5);
    expect(lost(enemy)).toBe(0);
    const mana = arcanist.mana;
    enemy.x = arcanist.x + 1;
    sim.run(0.2);
    const first = lost(enemy);
    expect(first).toBeGreaterThan(0);
    expect(arcanist.mana).toBeGreaterThanOrEqual(mana);
    expect(arcanist.skillCooldowns.get('frostNova') ?? 0).toBe(0);
    // Touching again soon does nothing
    enemy.x = 8;
    sim.run(0.3);
    enemy.x = arcanist.x + 1;
    sim.run(0.3);
    expect(lost(enemy)).toBe(first);
    // After 12 seconds it does
    enemy.x = 8;
    sim.run(12);
    enemy.x = arcanist.x + 1;
    sim.run(0.3);
    expect(lost(enemy)).toBeGreaterThan(first);
  });
});

describe('Fireball upgrades', () => {
  it('Volcano leaves a Fire field that raises the Fire damage of allies inside by 20%', () => {
    const { sim, arcanist } = arcanistWith('volcano');
    const target = foe(sim, 5, 0);
    spell(arcanist, 'fireball').release(arcanist, target, sim);
    const field = sim.zones.find((z) => z.kind === 'volcano');
    expect(field?.element).toBe(Element.Fire);
    const ally = spawnMerc(sim, 'ranger', 10, 5, 1);
    const far = spawnMerc(sim, 'ranger', 10, 12, 0);
    const dummy = foe(sim, 12, 3);
    const fire = (from: Unit): number =>
      from.hit(dummy, { kind: DamageKind.Magical, element: Element.Fire, fixed: 100 })?.value ?? 0;
    const frost = (from: Unit): number =>
      from.hit(dummy, { kind: DamageKind.Magical, element: Element.Frost, fixed: 100 })?.value ?? 0;
    expect(fire(ally) / fire(far)).toBeCloseTo(1.2, 5);
    expect(frost(ally)).toBe(frost(far));
    sim.run(4.5);
    expect(sim.zones).toHaveLength(0);
    expect(fire(ally)).toBe(fire(far));
  });

  it('Inferno is 4 tiles, costs 32, cools down in 12 s, and hurts allies below 60 Discipline', () => {
    const { sim, arcanist } = arcanistWith('inferno');
    const inferno = spell(arcanist, 'fireball');
    expect(inferno.cost).toBe(32);
    expect(inferno.cooldown).toBe(12);
    const target = foe(sim, 5, 0);
    const wide = foe(sim, 8, 0);
    const ally = spawnMerc(sim, 'vanguard', 10, 7, 1);
    arcanist.discipline = 40;
    expect(effectiveDiscipline(arcanist)).toBeLessThan(60);
    // Wanted for a crowd: two foes inside the wider blast, not the 2-tile one
    expect(inferno.wants(arcanist, target, sim)).toBe(true);
    expect(FIREBALL.wants(arcanist, target, sim)).toBe(false);
    inferno.release(arcanist, target, sim);
    expect(lost(wide)).toBeGreaterThan(0);
    expect(lost(ally)).toBeGreaterThan(0);
  });

  it('Inferno spares the party at 60 effective Discipline', () => {
    const { sim, arcanist } = arcanistWith('inferno');
    const target = foe(sim, 5, 0);
    const ally = spawnMerc(sim, 'vanguard', 10, 6, 1);
    arcanist.discipline = 100;
    arcanist.morale = 100;
    expect(effectiveDiscipline(arcanist)).toBeGreaterThanOrEqual(60);
    spell(arcanist, 'fireball').release(arcanist, target, sim);
    expect(lost(target)).toBeGreaterThan(0);
    expect(lost(ally)).toBe(0);
  });

  it('Echo casts the Fireball again, free, on its chance', () => {
    for (const roll of [true, false]) {
      const { sim, arcanist } = arcanistWith('echo');
      vi.spyOn(sim.rng, 'chance').mockReturnValue(roll);
      const a = foe(sim, 5, 0);
      const b = foe(sim, 5, 1);
      const hits: Unit[] = [];
      sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
        if (event.source === arcanist) {
          hits.push(event.target);
        }
      });
      const mana = arcanist.mana;
      const fireball = spell(arcanist, 'fireball');
      expect(arcanist.startCast(fireball, a)).toBe(true);
      sim.run(fireball.windup + 0.1);
      expect(hits.filter((h) => h === a)).toHaveLength(roll ? 2 : 1);
      expect(hits.filter((h) => h === b)).toHaveLength(roll ? 2 : 1);
      // Paid for once
      expect(mana - arcanist.mana).toBeGreaterThanOrEqual(fireball.cost - 3);
      expect(mana - arcanist.mana).toBeLessThan(fireball.cost * 2);
    }
  });
});

describe('Frost Shard upgrades', () => {
  it('Chill slows the target by 30% and builds Chill', () => {
    const { sim, arcanist } = arcanistWith('chill');
    const target = foe(sim, 5, 0);
    const buildups: number[] = [];
    sim.on(SimEvents.CheckBuildup, ValuePriority.Post, (event) => {
      if (event.status.id === 'chill') {
        buildups.push(event.value);
      }
    });
    spell(arcanist, 'frostShard').release(arcanist, target, sim);
    sim.run(2);
    expect(target.statuses.has(SHARD_SLOW.id)).toBe(true);
    expect(buildups.length).toBeGreaterThan(0);
    expect(target.speed).toBeLessThanOrEqual(target.kit.moveSpeed * 0.7 + 1e-9);
    sim.run(3.5);
    expect(target.statuses.has(SHARD_SLOW.id)).toBe(false);
  });

  it('Shatterpoint shatters an enemy killed while Frozen, with no corpse', () => {
    const { sim, arcanist } = arcanistWith('shatterpoint');
    const frozen = foe(sim, 5, 0);
    const near = foe(sim, 6.5, 0);
    const far = foe(sim, 9, 0);
    frozen.addStatus(FREEZE, arcanist);
    expect(frozen.statuses.has('freeze')).toBe(true);
    frozen.hp = 1;
    arcanist.hit(frozen, { kind: DamageKind.Magical, element: Element.Frost, fixed: 50 });
    expect(frozen.alive).toBe(false);
    expect(frozen.torn).toBe(true);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(far)).toBe(0);
  });

  it('Shatterpoint leaves a corpse and spares others when the enemy was not Frozen', () => {
    const { sim, arcanist } = arcanistWith('shatterpoint');
    const dying = foe(sim, 5, 0);
    const near = foe(sim, 6.5, 0);
    dying.hp = 1;
    arcanist.hit(dying, { kind: DamageKind.Magical, element: Element.Frost, fixed: 50 });
    expect(dying.alive).toBe(false);
    expect(dying.torn).toBe(false);
    expect(lost(near)).toBe(0);
  });

  it('Overchannel pays 5% of max health for a Frost Shard at 0 mana', () => {
    const { sim, arcanist } = arcanistWith('overchannel');
    const target = foe(sim, 5, 0);
    const shard = spell(arcanist, 'frostShard');
    arcanist.mana = 0;
    const maxHp = arcanist.derived.maxHp;
    expect(arcanist.canCast(shard)).toBe(true);
    expect(arcanist.startCast(shard, target)).toBe(true);
    expect(arcanist.mana).toBe(0);
    expect(arcanist.hp).toBeCloseTo(maxHp * 0.95, 5);
    // Other spells still need mana
    expect(arcanist.canCast(spell(arcanist, 'firebolt'))).toBe(false);
  });

  it('Overchannel costs mana as usual while there is mana, and never kills', () => {
    const { arcanist } = arcanistWith('overchannel');
    const shard = spell(arcanist, 'frostShard');
    const maxHp = arcanist.derived.maxHp;
    expect(arcanist.startCast(shard, null)).toBe(true);
    expect(arcanist.hp).toBe(maxHp);
    expect(arcanist.mana).toBeLessThan(arcanist.derived.maxMana);
    arcanist.cast = null;
    arcanist.skillCooldowns.clear();
    arcanist.mana = 0;
    arcanist.hp = maxHp * 0.05;
    expect(arcanist.canCast(shard)).toBe(false);
  });
});

describe('Firebolt upgrades', () => {
  it('Ignite doubles the Burn buildup', () => {
    const rank = 3;
    const plain = new Sim(3);
    alwaysHit(plain);
    spawnBearer(plain, 0, 0);
    const base = spawnMerc(plain, 'arcanist', 10, 1, 0, quiet());
    base.skillRanks.set('firebolt', rank);
    const baseTarget = foe(plain, 5, 0);
    const amounts = (sim: Sim): number[] => {
      const out: number[] = [];
      sim.on(SimEvents.CheckBuildup, ValuePriority.Post, (event) => {
        if (event.status === BURN) {
          out.push(event.value);
        }
      });
      return out;
    };
    const baseSeen = amounts(plain);
    spell(base, 'firebolt').release(base, baseTarget, plain);
    plain.run(1);

    const { sim, arcanist } = arcanistWith('ignite');
    arcanist.skillRanks.set('firebolt', rank);
    const target = foe(sim, 5, 0);
    const seen = amounts(sim);
    spell(arcanist, 'firebolt').release(arcanist, target, sim);
    sim.run(1);
    // The hit's own Fire buildup comes first, then the spell's
    expect(baseSeen[1]).toBe(fireboltBurn(rank));
    expect(seen[1]).toBe(fireboltBurn(rank) * 2);
  });

  it('Ignite spreads Burn from a burning enemy that dies to those within 2 tiles', () => {
    const { sim, arcanist } = arcanistWith('ignite');
    const dying = foe(sim, 5, 0);
    const near = foe(sim, 6.5, 0);
    const far = foe(sim, 9, 0);
    const seen: Unit[] = [];
    sim.on(SimEvents.CheckBuildup, ValuePriority.Post, (event) => {
      if (event.status === BURN) {
        seen.push(event.target);
      }
    });
    dying.addStatus(BURN, arcanist);
    dying.hp = 1;
    arcanist.hit(dying, { kind: DamageKind.Magical, element: Element.Fire, fixed: 50 });
    expect(dying.alive).toBe(false);
    expect(seen).toContain(near);
    expect(seen).not.toContain(far);
  });

  it('Ignite does not spread from an enemy that was not burning', () => {
    const { sim, arcanist } = arcanistWith('ignite');
    const dying = foe(sim, 5, 0);
    const near = foe(sim, 6.5, 0);
    dying.hp = 1;
    arcanist.hit(dying, { kind: DamageKind.Magical, element: Element.Fire, fixed: 50 });
    expect(near.buildup.get('burn') ?? 0).toBe(0);
  });

  it('Mana Flow returns 3 mana for each Firebolt hit', () => {
    const { sim, arcanist } = arcanistWith('manaFlow');
    const target = foe(sim, 5, 0);
    arcanist.mana = 10;
    arcanist.hit(target, {
      kind: DamageKind.Magical,
      element: Element.Fire,
      ratio: 100,
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    });
    expect(arcanist.mana).toBe(13);
    arcanist.hit(target, {
      kind: DamageKind.Magical,
      element: Element.Frost,
      ratio: 100,
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    });
    expect(arcanist.mana).toBe(13);
    // A real bolt does it too
    arcanist.mana = 10;
    spell(arcanist, 'firebolt').release(arcanist, target, sim);
    for (let i = 0; i < 60 && sim.projectiles.length > 0; i++) {
      sim.tick();
    }
    expect(arcanist.mana).toBeGreaterThanOrEqual(13);
  });

  it('Piercing Bolt passes through up to 3 enemies in a line', () => {
    const { sim, arcanist } = arcanistWith('piercingBolt');
    arcanist.x = 0;
    const line = [foe(sim, 2, 0), foe(sim, 3, 0), foe(sim, 4, 0), foe(sim, 5, 0)];
    const aside = foe(sim, 3, 3);
    spell(arcanist, 'firebolt').release(arcanist, line[0], sim);
    sim.run(2);
    expect(line.map((e) => lost(e) > 0)).toEqual([true, true, true, false]);
    expect(lost(aside)).toBe(0);
  });

  it('keeps the Elemental Sense check on the bolts it patches', () => {
    for (const id of ['chill', 'ignite', 'piercingBolt']) {
      const { sim, arcanist } = arcanistWith(id);
      const bolt = spell(arcanist, id === 'chill' ? 'frostShard' : 'firebolt');
      const target = foe(sim, 3, 0);
      // Frost Shard is not wanted by an Earth enemy, nor Firebolt by a Fire one
      target.element = id === 'chill' ? Element.Earth : Element.Fire;
      target.elementLevel = 1;
      expect(bolt.wants(arcanist, target, sim)).toBe(false);
    }
  });
});

describe('sides', () => {
  it('the Arcanist upgrades only affect enemies of the Arcanist', () => {
    const { sim, arcanist } = arcanistWith('shatterpoint');
    const ally = spawnMerc(sim, 'vanguard', 5, 3, 0);
    expect(ally.side).toBe(Side.Party);
    ally.addStatus(FREEZE, arcanist);
    ally.hp = 1;
    const bystander = foe(sim, 3.5, 0);
    arcanist.hit(ally, { kind: DamageKind.Magical, element: Element.Frost, fixed: 50 });
    expect(lost(bystander)).toBe(0);
  });
});

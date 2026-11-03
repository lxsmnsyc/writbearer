import { describe, expect, it } from 'vitest';
import { EventPriority } from '../../src/core/event-emitter';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { SANCTIFIED } from '../../src/content/bosses';
import { rankOf } from '../../src/content/skills';
import { DEFAULT_TOGGLES, Priority } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import type Nav from '../../src/sim/nav';
import Sim from '../../src/sim/sim';
import { type Skill, Targeting, areaVictims } from '../../src/sim/skill';
import { type StatusDef, buffsOf, stealBuff } from '../../src/sim/status';
import { BLIND } from '../../src/sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

// A skill with nothing in it but its friendly fire rule.
function spell(friendlyFire?: Skill['friendlyFire']): Skill {
  return {
    id: 'testBlast',
    name: 'Test Blast',
    describe: () => '',
    cost: 0,
    cooldown: 0,
    windup: 0,
    recovery: 0,
    targeting: Targeting.Self,
    friendlyFire,
    wants: () => true,
    elite: () => false,
    release: () => {},
  };
}

describe('Skill.friendlyFire', () => {
  it('leaves the caster own side out of an area by default', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 10, 10);
    const caster = spawnMerc(sim, 'arcanist', 5, 11, 10);
    const ally = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const foe = spawnMonster(sim, 'hollowArcher', 5, 13, 10);
    const hit = areaVictims(caster, spell(), foe, 4);
    expect(hit.map((v) => v.target)).toEqual([foe]);
    expect(hit[0].flags).toBe(DamageFlags.AoE);
    expect(hit.some((v) => v.target === ally || v.target === bearer)).toBe(false);
  });

  it('adds the caster own side, flagged, when the skill has it', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 10, 10);
    const caster = spawnMerc(sim, 'arcanist', 5, 11, 10);
    const ally = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const far = spawnMerc(sim, 'cleric', 5, 30, 30);
    const foe = spawnMonster(sim, 'hollowArcher', 5, 13, 10);
    const hit = areaVictims(caster, spell(true), foe, 4);
    const targets = hit.map((v) => v.target);
    expect(targets).toContain(foe);
    expect(targets).toContain(ally);
    expect(targets).toContain(bearer);
    expect(targets).not.toContain(caster);
    expect(targets).not.toContain(far);
    for (const v of hit) {
      const friendly = (v.flags & DamageFlags.FriendlyFire) !== 0;
      expect(friendly).toBe(v.target !== foe);
    }
  });

  it('lets a function decide per caster, and the hit carries the flag', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const caster = spawnMerc(sim, 'arcanist', 5, 11, 10);
    const ally = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const foe = spawnMonster(sim, 'hollowArcher', 5, 13, 10);
    const skill = spell((u) => u.level < 10);
    expect(areaVictims(caster, skill, foe, 4).length).toBe(3);
    caster.level = 10;
    expect(areaVictims(caster, skill, foe, 4).length).toBe(1);
    caster.level = 5;
    // A listener made here sees the flag on the party member's damage.
    const seen: number[] = [];
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.target === ally) {
        seen.push(event.flags);
      }
    });
    for (const v of areaVictims(caster, skill, foe, 4)) {
      caster.hit(v.target, { kind: DamageKind.Magical, flags: v.flags });
    }
    expect(seen.length).toBe(1);
    expect(seen[0] & DamageFlags.FriendlyFire).toBeTruthy();
    expect(ally.hp).toBeLessThan(ally.derived.maxHp);
  });
});

describe('StatusDef.buff', () => {
  const GILDED: StatusDef = { id: 'gilded', name: 'Gilded', duration: 5, immunity: 0, buff: true };
  const CURSED: StatusDef = { id: 'cursed', name: 'Cursed', duration: 5, immunity: 0 };

  it('lists only the buffs, and a thief takes one with its time left', () => {
    const sim = field();
    const thief = spawnMerc(sim, 'sellsword', 5, 10, 10);
    const foe = spawnMonster(sim, 'hollowArcher', 5, 12, 10);
    foe.addStatus(CURSED, foe);
    expect(buffsOf(foe)).toEqual([]);
    expect(stealBuff(thief, foe)).toBeNull();
    foe.addStatus(GILDED, foe, 5, 3);
    foe.statuses.get(GILDED.id)!.remaining = 2;
    expect(buffsOf(foe).map((s) => s.def)).toEqual([GILDED]);
    const taken = stealBuff(thief, foe);
    expect(taken?.def).toBe(GILDED);
    expect(taken?.remaining).toBe(2);
    expect(taken?.power).toBe(3);
    expect(foe.statuses.has(GILDED.id)).toBe(false);
    expect(foe.statuses.has(CURSED.id)).toBe(true);
    expect(thief.statuses.has(GILDED.id)).toBe(true);
  });
});

describe('stealBuff failures', () => {
  const GILDED: StatusDef = {
    id: 'gilded2',
    name: 'Gilded',
    duration: 5,
    immunity: 0,
    buff: true,
    maxStacks: 3,
  };

  it('leaves the buff where it was when the thief cannot take it, and keeps stacks', () => {
    const sim = field();
    const thief = spawnMerc(sim, 'sellsword', 5, 10, 10);
    const foe = spawnMonster(sim, 'hollowArcher', 5, 12, 10);
    foe.addStatus(GILDED, foe);
    foe.addStatus(GILDED, foe);
    thief.immunity.set(GILDED.id, 3);
    expect(stealBuff(thief, foe)).toBeNull();
    expect(foe.statuses.has(GILDED.id)).toBe(true);
    thief.immunity.clear();
    expect(stealBuff(thief, foe)?.stacks).toBe(2);
  });

  it('takes the Abbess Sanctified from an enemy', () => {
    const sim = field();
    const thief = spawnMerc(sim, 'sellsword', 5, 10, 10);
    const foe = spawnMonster(sim, 'hollowArcher', 5, 12, 10);
    foe.addStatus(SANCTIFIED, foe);
    expect(stealBuff(thief, foe)?.def).toBe(SANCTIFIED);
  });
});

describe('BLIND', () => {
  // The hit chance a CheckHit listener of the test reads for one attack.
  function chance(attacker: Unit, target: Unit): number {
    let seen = 0;
    const sim = attacker.sim;
    const listener = (event: { hitChance: number }): void => {
      seen = event.hitChance;
    };
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, listener);
    attacker.hit(target);
    sim.off(SimEvents.CheckHit, ValuePriority.Pre, listener);
    return seen;
  }

  it('builds up like Stun and lowers the hit chance of the blinded', () => {
    const sim = field();
    const attacker = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const target = spawnMonster(sim, 'hollowSoldier', 5, 11, 10);
    const before = chance(attacker, target);
    const against = chance(target, attacker);
    const limit = BLIND.threshold!(attacker);
    attacker.buildUp(BLIND, target, limit - 1);
    expect(attacker.statuses.has(BLIND.id)).toBe(false);
    attacker.buildUp(BLIND, target, 1);
    expect(attacker.statuses.has(BLIND.id)).toBe(true);
    expect(chance(attacker, target)).toBeLessThan(before);
    // The blind unit's own attacks only: those against it are unchanged.
    expect(chance(target, attacker)).toBe(against);
  });

  it('does not touch the hits of others, and ends with the status', () => {
    const sim = field();
    const attacker = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const target = spawnMonster(sim, 'hollowSoldier', 5, 11, 10);
    const before = chance(attacker, target);
    const other = chance(target, attacker);
    attacker.addStatus(BLIND, target);
    expect(chance(target, attacker)).toBe(other);
    attacker.removeStatus(BLIND.id);
    expect(chance(attacker, target)).toBe(before);
  });
});

describe('CheckChase', () => {
  // A bearer, a Vanguard that chases 3 tiles, and an enemy `gap` tiles from the bearer.
  function chase(gap: number): { sim: Sim; merc: Unit; foe: Unit } {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10, { ...DEFAULT_TOGGLES, chase: 3 });
    const foe = spawnMonster(sim, 'hollowArcher', 5, 10 + gap, 10);
    foe.aware = true;
    return { sim, merc, foe };
  }

  it('leaves the orders alone when nobody listens', () => {
    const { sim, merc } = chase(5);
    sim.tick(DT);
    expect(merc.target).toBeNull();
  });

  it('lets a listener widen how far a merc chases', () => {
    const { sim, merc, foe } = chase(5);
    sim.on(SimEvents.CheckChase, ValuePriority.Additive, (event) => {
      if (event.source === merc) {
        event.value += 3;
      }
    });
    sim.tick(DT);
    expect(merc.target).toBe(foe);
  });

  it('lets a listener shorten it, and reads the value the orders gave', () => {
    const { sim, merc } = chase(2);
    const starts: number[] = [];
    sim.on(SimEvents.CheckChase, ValuePriority.Additive, (event) => {
      starts.push(event.value);
      event.value = 1;
    });
    sim.tick(DT);
    expect(starts[0]).toBe(3);
    expect(merc.target).toBeNull();
  });
});

describe('CheckProjectile', () => {
  function shot(pierce: boolean): { sim: Sim; archer: Unit; near: Unit; far: Unit } {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const archer = spawnMerc(sim, 'ranger', 5, 10, 10);
    const near = spawnMonster(sim, 'hollowArcher', 5, 14, 10);
    const far = spawnMonster(sim, 'hollowArcher', 5, 16, 10);
    sim.fire(archer, pierce ? far : near, {
      speed: 14,
      homing: !pierce,
      pierce,
      options: { flags: DamageFlags.Projectile },
    });
    return { sim, archer, near, far };
  }

  function fly(sim: Sim): void {
    for (let t = 0; t < 1.5; t += DT) {
      sim.tick(DT);
    }
  }

  it('lets a homing arrow land when nobody listens', () => {
    const { sim, near } = shot(false);
    fly(sim);
    expect(near.hp).toBeLessThan(near.derived.maxHp);
  });

  it('stops a homing arrow whose event a listener disables', () => {
    const { sim, near } = shot(false);
    const seen: unknown[] = [];
    sim.on(SimEvents.CheckProjectile, EventPriority.Pre, (event) => {
      seen.push(event.target);
      event.disabled = true;
    });
    fly(sim);
    expect(seen).toContain(near);
    expect(near.hp).toBe(near.derived.maxHp);
    expect(sim.projectiles.length).toBe(0);
  });

  it('stops a piercing arrow at the first unit that blocks it', () => {
    const { sim, near, far } = shot(true);
    sim.on(SimEvents.CheckProjectile, EventPriority.Pre, (event) => {
      if (event.target === near) {
        event.disabled = true;
      }
    });
    fly(sim);
    expect(near.hp).toBe(near.derived.maxHp);
    expect(far.hp).toBe(far.derived.maxHp);
  });

  it('lets a listener pick which unit is shielded', () => {
    const { sim, near, far } = shot(true);
    sim.on(SimEvents.CheckProjectile, EventPriority.Pre, (event) => {
      if (event.target === far) {
        event.disabled = true;
      }
    });
    fly(sim);
    expect(near.hp).toBeLessThan(near.derived.maxHp);
    expect(far.hp).toBe(far.derived.maxHp);
  });
});

describe('nav.block', () => {
  // A strip of floor 4 tiles deep, and a wall across it at x = 10.
  function corridor(): { sim: Sim; walker: Unit; nav: Nav } {
    const sim = new Sim(1);
    sim.setWorld([{ x0: 0, z0: 0, x1: 20, z1: 4 }]);
    const walker = spawnMerc(sim, 'vanguard', 5, 5, 2);
    return { sim, walker, nav: sim.nav! };
  }

  const wall = (): [number, number][] => [
    [10, 0],
    [10, 1],
    [10, 2],
    [10, 3],
  ];

  // Walks without the sim's AI, so only the nav decides.
  function walk(sim: Sim, walker: Unit, seconds: number): void {
    for (let t = 0; t < seconds; t += DT) {
      walker.travel(15, 2, DT);
      sim.nav!.advance(DT);
    }
  }

  it('shuts the tiles and opens them when the time is up', () => {
    const { nav } = corridor();
    expect(nav.walkable(10.5, 1)).toBe(true);
    nav.block(wall(), 2);
    expect(nav.walkable(10.5, 1)).toBe(false);
    expect(nav.walkable(9.5, 1)).toBe(true);
    nav.advance(1);
    expect(nav.walkable(10.5, 1)).toBe(false);
    nav.advance(1.1);
    expect(nav.walkable(10.5, 1)).toBe(true);
  });

  it('keeps a walker on its side while a wall stands, then lets it through', () => {
    const { sim, walker, nav } = corridor();
    nav.block(wall(), 4);
    walk(sim, walker, 3);
    expect(walker.x).toBeLessThan(10);
    walk(sim, walker, 4);
    expect(walker.x).toBeGreaterThan(14);
  });

  it('holds against a crowd pressing on the wall', () => {
    const sim = new Sim(1);
    sim.setWorld([{ x0: 0, z0: 0, x1: 20, z1: 4 }]);
    spawnBearer(sim, 16, 2);
    const crowd: Unit[] = [];
    for (let i = 0; i < 10; i++) {
      const m = spawnMonster(sim, 'hollowSoldier', 5, 7 + (i % 3) * 0.4, 0.6 + i * 0.32);
      m.aware = true;
      crowd.push(m);
    }
    sim.nav!.block(wall(), 8);
    // No body is ever inside the wall while it stands.
    let inside = 0;
    while (sim.time < 7.9) {
      sim.tick();
      for (const m of crowd) {
        if (sim.nav!.shut(m.x, m.z)) {
          inside++;
        }
      }
    }
    expect(inside).toBe(0);
    sim.run(6);
    expect(crowd.some((m) => m.x > 11)).toBe(true);
  });

  it('is counted down by the sim ticks', () => {
    const { sim, nav } = corridor();
    nav.block(wall(), 1);
    sim.run(1.2);
    expect(nav.walkable(10.5, 1)).toBe(true);
  });

  it('lets a body already inside leave', () => {
    const { sim, walker, nav } = corridor();
    walker.x = 10.5;
    nav.block(wall(), 4);
    walk(sim, walker, 2);
    expect(walker.x).toBeGreaterThan(11);
  });
});

describe('Priority.WeakToElement', () => {
  // A Fire merc and two enemies, the nearer first, with the elements given.
  function weak(first: Element, second: Element): { sim: Sim; merc: Unit; near: Unit; far: Unit } {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'ranger', 5, 11, 10, {
      ...DEFAULT_TOGGLES,
      priorities: [Priority.WeakToElement, Priority.Nearest],
    });
    merc.attackElement = Element.Fire;
    const near = spawnMonster(sim, 'hollowArcher', 5, 13, 10);
    const far = spawnMonster(sim, 'hollowArcher', 5, 15, 10);
    near.element = first;
    far.element = second;
    near.aware = true;
    far.aware = true;
    return { sim, merc, near, far };
  }

  it('goes for the enemy that takes the most from its element', () => {
    const { sim, merc, far } = weak(Element.Fire, Element.Earth);
    sim.tick(DT);
    expect(merc.target).toBe(far);
  });

  it('falls back to the next priority when none is weak', () => {
    const { sim, merc, near } = weak(Element.Neutral, Element.Fire);
    sim.tick(DT);
    expect(merc.target).toBe(near);
  });

  it('counts the elements a CheckAttackElements listener adds', () => {
    // Fire takes 150% from Earth. Frost takes 150% from Fire.
    const { sim, merc, near } = weak(Element.Fire, Element.Earth);
    sim.on(SimEvents.CheckAttackElements, ValuePriority.Additive, (event) => {
      if (event.source === merc) {
        event.elements.push(Element.Frost);
      }
    });
    sim.tick(DT);
    // Both are at 150, so the nearer wins.
    expect(merc.target).toBe(near);
  });
});

describe('CheckSkillRank', () => {
  it('is the learned rank, at least 1, when nobody listens', () => {
    const sim = field();
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    merc.skillRanks.set('intercept', 3);
    expect(rankOf(merc, 'intercept')).toBe(3);
    expect(rankOf(merc, 'noSuchSkill')).toBe(1);
  });

  it('adds what a listener gives, to that skill and unit only', () => {
    const sim = field();
    const a = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const b = spawnMerc(sim, 'vanguard', 5, 12, 10);
    a.skillRanks.set('intercept', 3);
    b.skillRanks.set('intercept', 3);
    sim.on(SimEvents.CheckSkillRank, ValuePriority.Additive, (event) => {
      if (event.source === a && event.skill === 'intercept') {
        event.value += 2;
      }
    });
    expect(rankOf(a, 'intercept')).toBe(5);
    expect(rankOf(a, 'crush')).toBe(1);
    expect(rankOf(b, 'intercept')).toBe(3);
    // The learned rank is untouched.
    expect(a.skillRank('intercept')).toBe(3);
  });
});

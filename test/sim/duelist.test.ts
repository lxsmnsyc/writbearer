import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import {
  DUEL,
  DUELING,
  FLURRY,
  FLURRY_HITS,
  LUNGE,
  RIPOSTE,
  SHADOWSTEP,
  duelTime,
  flurryRatio,
  lungeRatio,
  partnerOf,
  shadowstepRatio,
} from '../../src/content/jobs/duelist/spells';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { EventPriority } from '../../src/core/event-emitter';
import { SimEvents } from '../../src/sim/events';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { canTarget } from '../../src/sim/targeting';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Range,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setRank } from '../support/build';

// The Duelist: Duel, Shadowstep, Lunge, Flurry and the innate Riposte.

// Every blow lands, except where a test says otherwise.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// Damage dealt by a unit's hits, by skill flag and ratio, as they land
function record(sim: Sim, source: Unit): { ratio: number; flags: number; value: number }[] {
  const hits: { ratio: number; flags: number; value: number }[] = [];
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.source === source) {
      hits.push({ ratio: event.ratio, flags: event.flags, value: event.value });
    }
  });
  return hits;
}

// Orders with every spell off except the ones named
function toggles(...on: string[]): Toggles {
  const skills: Toggles['skills'] = {};
  for (const id of ['duel', 'shadowstep', 'lunge', 'flurry']) {
    skills[id] = on.includes(id) ? SkillMode.Auto : SkillMode.Off;
  }
  return { ...DEFAULT_TOGGLES, skills };
}

describe('the Duelist job', () => {
  it('has 4 spells in cast order and Riposte, and is offered', () => {
    const def = JOBS.duelist;
    expect(def.spells.map((s) => s.id)).toEqual(['duel', 'shadowstep', 'lunge', 'flurry']);
    expect(def.innate.effect).toBe(RIPOSTE);
    expect(def.hireable).toBe(true);
    expect(def.role).toBe('striker');
  });

  it('spawns with its gear and spells, and wins a headless fight', () => {
    const sim = new Sim(5);
    const bearer = spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 5, 1, 0);
    const soldiers = [3, 4].map((x) => spawnMonster(sim, 'hollowSoldier', 3, x, 0.5));
    for (const s of soldiers) {
      s.aware = true;
    }
    expect(duelist.spells).toHaveLength(4);
    sim.run(60, () => !bearer.alive || sim.living(Side.Monster).length === 0);
    expect(sim.living(Side.Monster)).toHaveLength(0);
    expect(duelist.alive).toBe(true);
  });
});

describe('Duel', () => {
  it('binds the Duelist and an elite: neither can target, or be targeted by, anyone else', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 2, 0, toggles());
    const ranger = spawnMerc(sim, 'ranger', 8, 0, 1);
    const elite = spawnMonster(sim, 'hollowSoldier', 8, 3, 0, { elite: true });
    const other = spawnMonster(sim, 'hollowSoldier', 8, 3, 2);
    elite.aware = true;
    other.aware = true;
    expect(canTarget(ranger, elite)).toBe(true);
    expect(duelist.startCast(DUEL, elite)).toBe(true);
    sim.run(DUEL.windup + 0.05);
    expect(partnerOf(duelist)).toBe(elite);
    expect(partnerOf(elite)).toBe(duelist);
    // Outsiders cannot pick the elite, the Duelist cannot pick outsiders.
    expect(canTarget(ranger, elite)).toBe(false);
    expect(canTarget(bearer, elite)).toBe(false);
    expect(canTarget(duelist, other)).toBe(false);
    expect(canTarget(duelist, elite)).toBe(true);
    // The elite may not go for anyone else, and nobody else for the Duelist.
    expect(canTarget(elite, ranger)).toBe(false);
    expect(canTarget(elite, duelist)).toBe(true);
    expect(canTarget(other, duelist)).toBe(false);
    expect(canTarget(other, ranger)).toBe(true);
    sim.run(1);
    expect(elite.target).toBe(duelist);
    expect(duelist.target).toBe(elite);
  });

  it('lasts 4 + 0.5 a rank seconds, and ends when either fighter dies', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 8, 0, 1);
    const duelist = spawnMerc(sim, 'duelist', 8, 2, 0, toggles());
    duelist.kit.moveSpeed = 0;
    const elite = spawnMonster(sim, 'hollowSoldier', 8, 3, 0, { elite: true });
    elite.kit.moveSpeed = 0;
    elite.kit.interval = 99;
    duelist.kit.interval = 99;
    setRank(duelist, 'duel', 4);
    expect(duelTime(4)).toBe(6);
    expect(duelist.startCast(DUEL, elite)).toBe(true);
    sim.run(DUEL.windup + 5.5);
    expect(partnerOf(duelist)).toBe(elite);
    sim.run(0.7);
    expect(partnerOf(duelist)).toBeNull();
    expect(canTarget(ranger, elite)).toBe(true);

    // A second Duel, ended by a death.
    duelist.skillCooldowns.clear();
    duelist.mana = 100;
    expect(duelist.startCast(DUEL, elite)).toBe(true);
    sim.run(DUEL.windup + 0.1);
    expect(partnerOf(elite)).toBe(duelist);
    elite.hp = 0;
    elite.die(duelist);
    sim.tick();
    expect(partnerOf(duelist)).toBeNull();
    expect(duelist.statuses.has(DUELING.id)).toBe(false);
  });

  it('is only used on its own against an elite', () => {
    const casts = (elite: boolean): number => {
      const sim = new Sim(3);
      const bearer = spawnBearer(sim, 0, 0);
      spawnMerc(sim, 'duelist', 8, 1, 0, toggles('duel'));
      spawnMonster(sim, 'hollowSoldier', 6, 2, 0.4, { elite }).aware = true;
      let n = 0;
      sim.on(SimEvents.UnitSkillRelease, EventPriority.Post, (event) => {
        if (event.skill === DUEL) {
          n++;
        }
      });
      sim.run(10, () => !bearer.alive);
      return n;
    };
    expect(casts(true)).toBeGreaterThan(0);
    expect(casts(false)).toBe(0);
  });

  it('leaves area hits alone', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 2, 0, toggles());
    const ranger = spawnMerc(sim, 'ranger', 8, 0, 1);
    const elite = spawnMonster(sim, 'hollowSoldier', 8, 3, 0, { elite: true });
    const other = spawnMonster(sim, 'hollowSoldier', 8, 3, 2);
    duelist.startCast(DUEL, elite);
    sim.run(DUEL.windup + 0.05);
    const hp = other.hp;
    ranger.hit(other, { kind: DamageKind.Magical, flags: DamageFlags.Skill | DamageFlags.AoE });
    expect(other.hp).toBeLessThan(hp);
  });
});

describe('Shadowstep', () => {
  it('teleports behind a caster and hits it from behind', () => {
    const sim = new Sim(2);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 0, 0, toggles());
    duelist.kit.interval = 99;
    const soldier = spawnMonster(sim, 'hollowSoldier', 8, 3, 0);
    const cantor = spawnMonster(sim, 'cantor', 8, 6, 0);
    soldier.aware = true;
    cantor.aware = true;
    // The cantor faces the Duelist, so behind it is farther east.
    cantor.angle = Math.PI;
    const hits = record(sim, duelist);
    expect(duelist.startCast(SHADOWSTEP, cantor)).toBe(true);
    sim.run(SHADOWSTEP.windup + 0.01);
    expect(duelist.x).toBeGreaterThan(cantor.x);
    expect(duelist.distanceTo(cantor)).toBeLessThan(1.2);
    const hit = hits.find((h) => h.flags & DamageFlags.Skill);
    expect(hit?.ratio).toBe(shadowstepRatio(1));
    expect((hit?.flags ?? 0) & DamageFlags.Flank).toBeTruthy();
    expect(shadowstepRatio(5)).toBe(180);
  });

  it('chooses a caster or healer on its own, and nothing else', () => {
    const casts = (kind: 'cantor' | 'hollowSoldier'): number => {
      const sim = new Sim(4);
      alwaysHit(sim);
      const bearer = spawnBearer(sim, 0, 0);
      spawnMerc(sim, 'duelist', 8, 1, 0, toggles('shadowstep'));
      spawnMonster(sim, kind, 8, 5, 0).aware = true;
      let n = 0;
      sim.on(SimEvents.UnitSkillRelease, EventPriority.Post, (event) => {
        if (event.skill === SHADOWSTEP) {
          n++;
        }
      });
      sim.run(8, () => !bearer.alive);
      return n;
    };
    expect(casts('cantor')).toBeGreaterThan(0);
    expect(casts('hollowSoldier')).toBe(0);
  });
});

describe('Lunge', () => {
  it('closes the gap and strikes for 120% plus 10% a rank', () => {
    const sim = new Sim(2);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 0, 0, toggles());
    duelist.kit.interval = 99;
    const soldier = spawnMonster(sim, 'hollowSoldier', 8, 3.5, 0);
    soldier.kit.moveSpeed = 0;
    soldier.aware = true;
    const hits = record(sim, duelist);
    expect(duelist.startCast(LUNGE, soldier)).toBe(true);
    sim.run(LUNGE.windup + 0.01);
    expect(duelist.distanceTo(soldier)).toBeLessThanOrEqual(duelist.kit.reach);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.ratio).toBe(lungeRatio(1));
    expect(lungeRatio(10)).toBe(220);
  });

  it('does not reach past its range', () => {
    const sim = new Sim(2);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 0, 0, toggles());
    const far = spawnMonster(sim, 'hollowSoldier', 8, 7, 0);
    far.aware = true;
    const hits = record(sim, duelist);
    duelist.startCast(LUNGE, far);
    sim.run(LUNGE.windup + 0.01);
    expect(hits).toHaveLength(0);
    expect(duelist.x).toBe(0);
  });
});

describe('Flurry', () => {
  it('lands four hits, each through the damage pipeline, for 40% plus 4% a rank', () => {
    const sim = new Sim(2);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 0, 0, toggles());
    duelist.kit.interval = 99;
    const soldier = spawnMonster(sim, 'hollowShieldbearer', 8, 0.8, 0);
    soldier.kit.moveSpeed = 0;
    soldier.kit.interval = 99;
    soldier.hp = 100000;
    soldier.aware = true;
    const hits = record(sim, duelist);
    expect(duelist.startCast(FLURRY, soldier)).toBe(true);
    sim.run(FLURRY.windup + 0.01);
    expect(hits).toHaveLength(FLURRY_HITS);
    for (const hit of hits) {
      expect(hit.ratio).toBe(flurryRatio(1));
      expect(hit.value).toBeGreaterThan(0);
    }
    expect(flurryRatio(10)).toBe(80);
  });

  it('stops when the target falls, and is the filler used in reach', () => {
    const sim = new Sim(3);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const duelist = spawnMerc(sim, 'duelist', 8, 1, 0, toggles('flurry'));
    const mite = spawnMonster(sim, 'hollowSoldier', 1, 2, 0);
    mite.hp = 1;
    mite.aware = true;
    const hits = record(sim, duelist);
    let casts = 0;
    sim.on(SimEvents.UnitSkillRelease, EventPriority.Post, (event) => {
      if (event.skill === FLURRY) {
        casts++;
      }
    });
    sim.run(10, () => !bearer.alive || !mite.alive);
    expect(casts).toBeLessThanOrEqual(1);
    expect(mite.alive).toBe(false);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('Riposte', () => {
  // A hit on the Duelist from a monster, as a basic attack lands
  const swing = (
    from: Unit,
    to: Unit,
    range = Range.Melee,
    flags = DamageFlags.BasicAttack,
  ): ReturnType<Unit['hit']> =>
    from.hit(to, { kind: DamageKind.Physical, range, fixed: 20, flags });

  it('parries about 15% of melee hits and answers each with a counter', () => {
    const sim = new Sim(11);
    alwaysHit(sim);
    const duelist = spawnMerc(sim, 'duelist', 10, 0, 0);
    duelist.hp = 1e9;
    const brute = spawnMonster(sim, 'hollowSoldier', 10, 1, 0);
    brute.hp = 1e9;
    const counters = record(sim, duelist);
    let parried = 0;
    sim.on(SimEvents.UnitMiss, EventPriority.Post, (event) => {
      if (event.target === duelist) {
        parried++;
      }
    });
    const N = 2000;
    let landed = 0;
    for (let i = 0; i < N; i++) {
      const hp = duelist.hp;
      swing(brute, duelist);
      if (duelist.hp < hp) {
        landed++;
      }
    }
    expect(parried / N).toBeGreaterThan(0.1);
    expect(parried / N).toBeLessThan(0.2);
    expect(landed + parried).toBe(N);
    // One counter per parry, and none of them was parried back.
    expect(counters).toHaveLength(parried);
    for (const c of counters) {
      expect(c.flags & DamageFlags.BasicAttack).toBeTruthy();
      expect(c.value).toBeGreaterThan(0);
    }
  });

  it('ignores ranged hits and area hits, and never parries a counter', () => {
    const sim = new Sim(12);
    alwaysHit(sim);
    const duelist = spawnMerc(sim, 'duelist', 10, 0, 0);
    duelist.hp = 1e9;
    const brute = spawnMonster(sim, 'hollowSoldier', 10, 1, 0);
    brute.hp = 1e9;
    let misses = 0;
    sim.on(SimEvents.UnitMiss, EventPriority.Post, () => {
      misses++;
    });
    for (let i = 0; i < 400; i++) {
      swing(brute, duelist, Range.Ranged);
      swing(brute, duelist, Range.Melee, DamageFlags.Sure);
    }
    expect(misses).toBe(0);

    // Two Duelists: a parried hit is countered once, never parried back.
    const second = spawnMonster(sim, 'hollowSoldier', 10, 2, 0);
    second.hp = 1e9;
    RIPOSTE.setup(second, 1).start();
    let blows = 0;
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, () => {
      blows++;
    });
    for (let i = 0; i < 300; i++) {
      swing(second, duelist);
    }
    // 300 swings and at most 300 counters: no endless exchange.
    expect(blows).toBeLessThan(700);
  });
});

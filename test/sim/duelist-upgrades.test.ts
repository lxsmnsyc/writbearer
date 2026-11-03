import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import {
  FLURRY_HITS,
  LUNGE,
  duelTime,
  flurryRatio,
  lungeRatio,
  partnerOf,
} from '../../src/content/jobs/duelist/spells';
import DUELIST_UPGRADES, {
  ASSASSINS_MARK,
  SIDESTEPPING,
  SMOKED,
} from '../../src/content/jobs/duelist/upgrades';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { type Upgrade, isBuilt } from '../../src/sim/builds';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { type Skill, SkillMode } from '../../src/sim/skill';
import { BLEED } from '../../src/sim/statuses';
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
import { setRank, withUpgrade } from '../support/build';

// The Duelist's 12 elite upgrades.

const SPELLS = ['duel', 'shadowstep', 'lunge', 'flurry'];

const upgrade = (id: string): Upgrade => {
  const found = DUELIST_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// Every blow lands, unless a later listener says otherwise.
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

// A still Duelist next to the bearer, with an upgrade when one is named
function duelistWith(id: string | null, seed = 3): { sim: Sim; duelist: Unit } {
  const sim = new Sim(seed);
  alwaysHit(sim);
  spawnBearer(sim, -4, 0);
  const duelist = spawnMerc(sim, 'duelist', 10, 0, 0, quiet());
  // No basic attacks and no walking, so only the spells act
  duelist.kit.interval = 0;
  duelist.kit.moveSpeed = 0;
  duelist.mana = duelist.derived.maxMana;
  if (id) {
    withUpgrade(duelist, upgrade(id));
  }
  return { sim, duelist };
}

// A still, awake, tough monster
function foe(
  sim: Sim,
  x: number,
  z: number,
  elite = false,
  kind: Parameters<typeof spawnMonster>[1] = 'hollowSoldier',
): Unit {
  const m = spawnMonster(sim, kind, 3, x, z, { elite });
  m.aware = true;
  m.kit.moveSpeed = 0;
  m.kit.interval = 99;
  m.cooldown = 99;
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

// Casts a spell from start to release
function cast(sim: Sim, u: Unit, id: string, target: Unit | null): void {
  const s = spell(u, id);
  expect(u.startCast(s, target)).toBe(true);
  sim.run(s.windup + 0.01);
}

// The Duelist's blows as they land
function record(sim: Sim, source: Unit): { target: Unit; flags: number; value: number }[] {
  const hits: { target: Unit; flags: number; value: number }[] = [];
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.source === source) {
      hits.push({ target: event.target, flags: event.flags, value: event.value });
    }
  });
  return hits;
}

// A fixed True blow, so only the upgrades change its size
const blow = (from: Unit, to: Unit): number =>
  from.hit(to, { kind: DamageKind.True, fixed: 100, flags: DamageFlags.BasicAttack })?.value ?? 0;

describe('the Duelist upgrades', () => {
  it('has 12, three per spell, each with a patch or an effect', () => {
    const { upgrades, spells } = JOBS.duelist;
    expect(upgrades).toBe(DUELIST_UPGRADES);
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

describe('Duel upgrades', () => {
  it('Grand Duel lasts until one of them dies, with +50 crit rate on the partner', () => {
    const { sim, duelist } = duelistWith('grandDuel');
    const elite = foe(sim, 2, 0, true);
    const other = foe(sim, 2, 3);
    const rates = new Map<Unit, number>();
    sim.on(SimEvents.CheckHit, ValuePriority.Exact, (event) => {
      if (event.source === duelist) {
        rates.set(event.target, event.critRate);
      }
    });
    const base = duelist.derived.crit;
    cast(sim, duelist, 'duel', elite);
    sim.run(duelTime(10) + 5);
    expect(partnerOf(duelist)).toBe(elite);
    duelist.hit(elite, {});
    duelist.hit(other, {});
    expect(rates.get(elite)).toBeCloseTo(base + 50);
    expect(rates.get(other)).toBeCloseTo(base);
    elite.hp = 0;
    elite.die(duelist);
    sim.tick();
    expect(partnerOf(duelist)).toBeNull();
  });

  it('Crowd Pleaser raises the party morale by 1 a second during the Duel', () => {
    const { sim, duelist } = duelistWith('crowdPleaser');
    const ranger = spawnMerc(sim, 'ranger', 5, -3, 1, quiet());
    ranger.kit.interval = 0;
    const elite = foe(sim, 2, 0, true);
    ranger.morale = 50;
    duelist.morale = 50;
    sim.run(2);
    expect(ranger.morale).toBe(50);
    cast(sim, duelist, 'duel', elite);
    sim.run(3);
    expect(ranger.morale).toBeGreaterThanOrEqual(52);
    expect(ranger.morale).toBeLessThanOrEqual(53);
    expect(duelist.morale).toBe(ranger.morale);
    // Once the Duel ends, it stops.
    sim.run(duelTime(1) + 1);
    expect(partnerOf(duelist)).toBeNull();
    const after = ranger.morale;
    sim.run(3);
    expect(ranger.morale).toBe(after);
  });

  it('Taunt the Proud starts a Duel with an elite 6 tiles away, which walks to the Duelist', () => {
    const { sim, duelist } = duelistWith('tauntTheProud');
    const elite = spawnMonster(sim, 'hollowSoldier', 3, 5.5, 0, { elite: true });
    elite.aware = true;
    elite.kit.interval = 99;
    foe(sim, 1, 3);
    const s = spell(duelist, 'duel');
    // The plain Duel would not reach it.
    expect(JOBS.duelist.spells[0].wants(duelist, elite, sim)).toBe(false);
    expect(s.aim?.(duelist, sim)).toBe(elite);
    expect(s.wants(duelist, elite, sim)).toBe(true);
    cast(sim, duelist, 'duel', elite);
    expect(partnerOf(duelist)).toBe(elite);
    sim.run(2);
    expect(elite.distanceTo(duelist)).toBeLessThan(2);
    expect(elite.target).toBe(duelist);
  });
});

describe('Shadowstep upgrades', () => {
  it('Flourish gives back mana and morale and resets the cooldown on a kill, only then', () => {
    const { sim, duelist } = duelistWith('flourish');
    const cantor = foe(sim, 4, 0, false, 'cantor');
    cantor.hp = 1;
    duelist.morale = 50;
    duelist.mana = 40;
    const s = spell(duelist, 'shadowstep');
    expect(duelist.startCast(s, cantor)).toBe(true);
    const mana = duelist.mana;
    sim.run(s.windup + 0.01);
    expect(cantor.alive).toBe(false);
    expect(duelist.mana).toBeCloseTo(mana + 15, 0);
    expect(duelist.morale).toBe(51);
    expect(duelist.skillCooldowns.get('shadowstep')).toBe(0);

    // A Shadowstep that does not kill keeps its cooldown.
    const tough = foe(sim, 6, 2, false, 'cantor');
    sim.run(1);
    cast(sim, duelist, 'shadowstep', tough);
    expect(tough.alive).toBe(true);
    expect(duelist.skillCooldowns.get('shadowstep')).toBeGreaterThan(5);
    expect(duelist.morale).toBe(51);
  });

  it('Smoke Step leaves a cloud and the enemies lose track of the Duelist for 3 seconds', () => {
    const { sim, duelist } = duelistWith('smokeStep');
    const cantor = foe(sim, 4, 0, false, 'cantor');
    const soldier = foe(sim, 1, 1);
    expect(canTarget(soldier, duelist)).toBe(true);
    cast(sim, duelist, 'shadowstep', cantor);
    expect(duelist.x).toBeGreaterThan(2);
    const smoke = sim.zones.find((z) => z.kind === 'smoke');
    expect(smoke?.x).toBe(0);
    expect(smoke?.z).toBe(0);
    expect(duelist.statuses.has(SMOKED.id)).toBe(true);
    expect(canTarget(soldier, duelist)).toBe(false);
    expect(canTarget(cantor, duelist)).toBe(false);
    // The Duelist still picks its own targets.
    expect(canTarget(duelist, cantor)).toBe(true);
    sim.run(3.1);
    expect(canTarget(soldier, duelist)).toBe(true);
  });

  it("Assassin's Mark makes the Duelist's next 3 hits deal 20% more", () => {
    const { sim, duelist } = duelistWith('assassinsMark');
    const cantor = foe(sim, 4, 0, false, 'cantor');
    cast(sim, duelist, 'shadowstep', cantor);
    expect(cantor.statuses.has(ASSASSINS_MARK.id)).toBe(true);
    // Others' hits do not count.
    const bearer = sim.bearer!;
    expect(blow(bearer, cantor)).toBe(100);
    expect([blow(duelist, cantor), blow(duelist, cantor), blow(duelist, cantor)]).toEqual([
      120, 120, 120,
    ]);
    expect(blow(duelist, cantor)).toBe(100);
    expect(cantor.statuses.has(ASSASSINS_MARK.id)).toBe(false);
  });
});

describe('Lunge upgrades', () => {
  // A shield that always blocks half, held toward the Duelist
  function shielded(sim: Sim): Unit {
    const m = foe(sim, 3, 0);
    m.angle = Math.PI;
    m.derived.blockChance = 100;
    m.derived.blockAmount = 50;
    return m;
  }

  it('Feint: the thrust cannot be blocked, other blows still can', () => {
    const plain = duelistWith(null);
    const plainHits = record(plain.sim, plain.duelist);
    cast(plain.sim, plain.duelist, 'lunge', shielded(plain.sim));
    expect(plainHits[0]?.flags & DamageFlags.Blocked).toBeTruthy();

    const { sim, duelist } = duelistWith('feint');
    const target = shielded(sim);
    const hits = record(sim, duelist);
    cast(sim, duelist, 'lunge', target);
    expect(hits).toHaveLength(1);
    expect(hits[0].flags & DamageFlags.Blocked).toBe(0);
    expect(hits[0].flags & DamageFlags.Flank).toBe(0);
    duelist.hit(target, { flags: DamageFlags.BasicAttack });
    expect(hits[1]?.flags & DamageFlags.Blocked).toBeTruthy();
  });

  it('Sidestep ends with a step aside and 30 less hit chance against the Duelist for 3 seconds', () => {
    const { sim, duelist } = duelistWith('sidestep');
    const target = foe(sim, 3, 0);
    const chances: number[] = [];
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, (event) => {
      if (event.target === duelist) {
        chances.push(event.hitChance);
      }
    });
    target.hit(duelist, { range: Range.Melee, flags: DamageFlags.Sure });
    cast(sim, duelist, 'lunge', target);
    expect(Math.abs(duelist.z)).toBeGreaterThan(0.5);
    expect(duelist.statuses.has(SIDESTEPPING.id)).toBe(true);
    target.hit(duelist, { range: Range.Melee, flags: DamageFlags.Sure });
    expect(chances[1]).toBe(chances[0] - 30);
    sim.run(3.1);
    expect(duelist.statuses.has(SIDESTEPPING.id)).toBe(false);
  });

  it('Untouchable fires Lunge by itself after an evade, free and critical, once a cooldown', () => {
    const { sim, duelist } = duelistWith('untouchable');
    const brute = foe(sim, 3, 0);
    // Every blow at the Duelist misses, and none is parried
    duelist.passives.get('riposte')?.stop();
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      if (event.target === duelist) {
        event.hit = false;
      }
    });
    const hits = record(sim, duelist);
    const mana = duelist.mana;
    brute.hit(duelist, { range: Range.Melee });
    expect(hits).toHaveLength(1);
    expect(hits[0].target).toBe(brute);
    expect(hits[0].flags & DamageFlags.Critical).toBeTruthy();
    expect(duelist.distanceTo(brute)).toBeLessThanOrEqual(duelist.kit.reach);
    expect(duelist.mana).toBe(mana);
    expect(duelist.skillCooldowns.get('lunge')).toBe(LUNGE.cooldown);
    brute.hit(duelist, { range: Range.Melee });
    expect(hits).toHaveLength(1);
    sim.run(LUNGE.cooldown + 0.1);
    brute.hit(duelist, { range: Range.Melee });
    expect(hits).toHaveLength(2);
    expect(lungeRatio(1)).toBe(130);
  });
});

describe('Flurry upgrades', () => {
  it('Bleed Out: a critical Flurry hit makes the target bleed, other crits do not', () => {
    const { sim, duelist } = duelistWith('bleedOut');
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      if (event.source === duelist) {
        event.critical = true;
      }
    });
    const near = foe(sim, 0.8, 0);
    const other = foe(sim, 0, 0.8);
    duelist.hit(other, { flags: DamageFlags.BasicAttack });
    expect(other.statuses.has(BLEED.id)).toBe(false);
    cast(sim, duelist, 'flurry', near);
    expect(near.statuses.has(BLEED.id)).toBe(true);
    // It ticks as True damage over time.
    const ticks: number[] = [];
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.target === near && event.flags & DamageFlags.DoT) {
        expect(event.kind).toBe(DamageKind.True);
        ticks.push(event.value);
      }
    });
    sim.run(2.1);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('Thousand Cuts adds 3% a hit in a row on the same target, reset by a switch', () => {
    const { sim, duelist } = duelistWith('thousandCuts');
    const a = foe(sim, 1, 0);
    const b = foe(sim, 0, 1);
    expect([blow(duelist, a), blow(duelist, a), blow(duelist, a)]).toEqual([100, 103, 106]);
    expect(blow(duelist, b)).toBe(100);
    expect(blow(duelist, a)).toBe(100);
    for (let i = 0; i < 40; i++) {
      blow(duelist, a);
    }
    // It stops growing at 20 hits.
    expect(blow(duelist, a)).toBe(160);
  });

  it('Whirlwind strikes every enemy within 2 tiles, one hit each in turn', () => {
    const { sim, duelist } = duelistWith('whirlwind');
    setRank(duelist, 'flurry', 3);
    const near = [foe(sim, 1, 0), foe(sim, -1, 0.5), foe(sim, 0, -1.8)];
    const far = foe(sim, 3, 0);
    const s = spell(duelist, 'flurry');
    expect(s.wants(duelist, far, sim)).toBe(true);
    const hits = record(sim, duelist);
    const ratios: number[] = [];
    sim.on(SimEvents.UnitDamage, DamagePriority.Initial, (event) => {
      if (event.source === duelist) {
        ratios.push(event.ratio);
      }
    });
    cast(sim, duelist, 'flurry', far);
    expect(hits).toHaveLength(FLURRY_HITS * near.length);
    for (let i = 0; i < hits.length; i++) {
      expect(hits[i].target).toBe(near[i % near.length]);
      expect(hits[i].flags & DamageFlags.AoE).toBeTruthy();
    }
    expect(ratios.every((r) => r === flurryRatio(3))).toBe(true);
    expect(hits.some((h) => h.target === far)).toBe(false);

    // With nobody near, it is not wanted.
    for (const m of near) {
      m.hp = 0;
      m.die(duelist);
    }
    expect(s.wants(duelist, far, sim)).toBe(false);
    expect(sim.living(Side.Monster)).toEqual([far]);
  });
});

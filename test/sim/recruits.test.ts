import { describe, expect, it } from 'vitest';
import { FIGHTERS, rollOffer, rollStartingOffers, wageFor } from '../../src/content/recruits';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { CLEANSE, HEAL, RENEW, RESURRECTION, SMITE } from '../../src/content/skills';
import { TRAIT_BY_ID, rollTraits } from '../../src/content/traits';
import RNG from '../../src/core/rng';
import { START_GOLD } from '../../src/game/game';
import { START_LEVEL } from '../../src/game/stage';
import { RunStreams, Stream } from '../../src/core/seed';
import { RECRUIT_STAGES, generateStage } from '../../src/gen/stage';
import { DEFAULT_TOGGLES, Priority } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { DREAD, POISON, STUN } from '../../src/sim/statuses';
import { DamageFlags, DamageKind, DamagePriority } from '../../src/sim/types';

describe('offers', () => {
  it('start a run with fighters only, every fighting job among them, the same for the same seed', () => {
    for (const seed of ['ASHEN', 'BRINE', 'COAL', 'DUSK', 'EMBER']) {
      const roll = (): string[] =>
        rollStartingOffers(new RunStreams(seed).get(1, Stream.Recruits), 5).map(
          (o) => `${o.kind}:${o.name}:${o.traits.join('+')}`,
        );
      const offers = roll();
      const kinds = offers.map((o) => o.split(':')[0]);
      expect(offers).toHaveLength(3);
      expect(kinds).not.toContain('cleric');
      expect(new Set(kinds)).toEqual(new Set(FIGHTERS));
      expect(roll()).toEqual(offers);
    }
  });

  it('start with gold enough to hire three mercs by the fires', () => {
    expect(START_GOLD).toBeGreaterThanOrEqual(3 * wageFor(START_LEVEL));
  });

  it('never roll traits that exclude each other', () => {
    const rng = new RNG(9);
    for (let i = 0; i < 500; i++) {
      const [a, b] = rollTraits(rng);
      if (b) {
        expect(TRAIT_BY_ID.get(a)!.excludes ?? []).not.toContain(b);
        expect(TRAIT_BY_ID.get(b)!.excludes ?? []).not.toContain(a);
      }
    }
  });

  it('ask a greedy merc for more', () => {
    const rng = new RNG(3);
    const offers = Array.from({ length: 300 }, () => rollOffer(rng, 5));
    const greedy = offers.find((o) => o.traits.length === 1 && o.traits[0] === 'greedy')!;
    const plain = offers.find((o) => o.traits.length === 1 && o.traits[0] === 'brave')!;
    expect(greedy.wage).toBeGreaterThan(plain.wage);
  });

  it('wait by fires only in the first two phases', () => {
    const fires = (from: number, to: number): number => {
      let n = 0;
      for (let i = from; i < to; i++) {
        n += generateStage(new RunStreams('ASHEN').area(1, Stream.Layout, i), i).recruit ? 1 : 0;
      }
      return n;
    };
    expect(fires(1, RECRUIT_STAGES)).toBeGreaterThan(0);
    expect(fires(RECRUIT_STAGES, RECRUIT_STAGES + 12)).toBe(0);
  });
});

describe('traits', () => {
  it('Brave: dread never takes hold', () => {
    const sim = new Sim(1);
    const brave = spawnMerc(sim, 'vanguard', 5, 0, 0, undefined, { traits: ['brave'] });
    const hollowed = spawnMonster(sim, 'hollowed', 4, 9, 0);
    expect(brave.addStatus(DREAD, hollowed)).toBeNull();
  });

  it('Devout: dread builds up at half the rate', () => {
    const sim = new Sim(1);
    const devout = spawnMerc(sim, 'vanguard', 5, 0, 0, undefined, { traits: ['devout'] });
    const hollowed = spawnMonster(sim, 'hollowed', 4, 9, 0);
    devout.buildUp(DREAD, hollowed, 20);
    expect(devout.buildup.get(DREAD.id)).toBe(10);
  });

  it('Cowardly: runs from the nearest enemy when near death', () => {
    const sim = new Sim(1);
    const coward = spawnMerc(sim, 'vanguard', 5, 0, 0, undefined, { traits: ['cowardly'] });
    const crawler = spawnMonster(sim, 'crawler', 4, 1.5, 0);
    crawler.aware = true;
    crawler.kit.moveSpeed = 0;
    // No potions, or it drinks its way back above the line.
    coward.belt.fill(null);
    coward.hp = coward.derived.maxHp * 0.2;
    const before = coward.distanceTo(crawler);
    sim.run(1);
    expect(coward.distanceTo(crawler)).toBeGreaterThan(before + 1);
  });

  it('Glory-seeker: goes for the elite whatever its orders say', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const merc = spawnMerc(
      sim,
      'ranger',
      5,
      0,
      1,
      { ...DEFAULT_TOGGLES, priorities: [Priority.Nearest] },
      { traits: ['gloryseeker'] },
    );
    spawnMonster(sim, 'crawler', 4, 2, 1).aware = true;
    const elite = spawnMonster(sim, 'crawler', 4, 5, 1, { elite: true });
    elite.aware = true;
    sim.tick();
    expect(merc.target).toBe(elite);
  });
});

describe('the Cleric', () => {
  it('heals the bearer first when it is hurt', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 5, 1, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, -1, 0);
    vanguard.hp = vanguard.derived.maxHp * 0.3;
    bearer.hp = bearer.derived.maxHp * 0.5;
    expect(HEAL.aim!(cleric, sim)).toBe(bearer);
    expect(cleric.startCast(HEAL, bearer)).toBe(true);
    const hp = bearer.hp;
    sim.run(HEAL.windup + 0.05);
    expect(bearer.hp).toBeGreaterThan(hp + 40);
  });

  it('renews over time', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 5, 1, 0);
    bearer.hp = 50;
    cleric.startCast(RENEW, bearer);
    sim.run(RENEW.windup + 3.05);
    expect(bearer.hp).toBe(50 + 3 * 14);
  });

  it('cleanses harmful statuses and buildup, and leaves its own', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 5, 1, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 20, 0);
    vanguard.addStatus(POISON, crawler);
    vanguard.buildUp(STUN, crawler, 60);
    expect(CLEANSE.aim!(cleric, sim)).toBe(vanguard);
    cleric.startCast(CLEANSE, vanguard);
    sim.run(CLEANSE.windup + 0.05);
    expect(vanguard.statuses.has(POISON.id)).toBe(false);
    expect(vanguard.buildup.size).toBe(0);
  });

  it('raises a fallen merc, but not one torn apart', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 5, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 1, 0);
    const ranger = spawnMerc(sim, 'ranger', 5, -1, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 20, 0);
    // A small killing blow leaves a corpse; a huge one tears the body.
    vanguard.hp = 1;
    crawler.hit(vanguard, { kind: DamageKind.True, fixed: 5 });
    crawler.hit(ranger, { kind: DamageKind.True, fixed: 10000 });
    expect(vanguard.torn).toBe(false);
    expect(ranger.torn).toBe(true);
    cleric.skillRanks.set('resurrection', 3);
    expect(RESURRECTION.aim!(cleric, sim)).toBe(vanguard);
    cleric.mana = 100;
    cleric.startCast(RESURRECTION, vanguard);
    sim.run(RESURRECTION.windup + 0.05);
    expect(vanguard.alive).toBe(true);
    expect(vanguard.hp).toBe(Math.floor(vanguard.derived.maxHp * 0.3));
    expect(ranger.revive(0.5)).toBe(false);
  });

  it('smites the Undead harder', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 5, 0, 0);
    const soldier = spawnMonster(sim, 'hollowSoldier', 4, 3, 0);
    const ratios: number[] = [];
    sim.on(SimEvents.UnitDamage, DamagePriority.Initial, (event) => {
      if (event.flags & DamageFlags.Skill) {
        ratios.push(event.ratio);
      }
    });
    cleric.startCast(SMITE, soldier);
    sim.run(SMITE.windup + 0.05);
    expect(ratios[0]).toBe(130 * 1.5);
  });
});

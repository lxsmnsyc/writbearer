import { describe, expect, it } from 'vitest';
import { beginDuel } from '../../src/content/jobs/duelist/spells';
import { WARD } from '../../src/content/cleric';
import CLERIC_UPGRADES from '../../src/content/jobs/cleric/upgrades';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { rankOf } from '../../src/content/skills';
import { Hunt } from '../../src/sim/ai';
import {
  CONTROLLED,
  CONTROL_TIME,
  control,
  freeControlled,
  isControlled,
} from '../../src/sim/control';
import { copySkill, lastReleased } from '../../src/sim/copy';
import { SimEvents } from '../../src/sim/events';
import RNG from '../../src/core/rng';
import { generateStage } from '../../src/gen/stage';
import { carryParty } from '../../src/game/stage';
import { Pack, Vault } from '../../src/game/inventory';
import { snapshot } from '../../src/game/game/saving';
import type GameState from '../../src/game/game/state';
import { canTarget } from '../../src/sim/targeting';
import Sim from '../../src/sim/sim';
import { type Skill, Targeting } from '../../src/sim/skill';
import { type StatusDef, stealBuff } from '../../src/sim/status';
import { DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setRank, withUpgrade } from '../support/build';

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

// A boss and a merc that stands in its reach, with the bearer behind.
function scene(): { sim: Sim; bearer: Unit; merc: Unit; boss: Unit } {
  const sim = field();
  const bearer = spawnBearer(sim, 10, 10);
  const merc = spawnMerc(sim, 'vanguard', 10, 11, 10);
  merc.hunt = Hunt.Support;
  merc.order = { x: 5, z: 5 };
  const boss = spawnMonster(sim, 'hollowSoldier', 10, 30, 30);
  return { sim, bearer, merc, boss };
}

describe('mind control', () => {
  it('turns the merc on the party for 6 s, then gives back side, hunt and orders', () => {
    const { sim, bearer, merc, boss } = scene();
    const before = bearer.hp;
    expect(control(boss, merc)).not.toBeNull();
    expect(merc.side).toBe(Side.Monster);
    expect(isControlled(merc)).toBe(true);
    bearer.x = merc.x + 0.6;
    bearer.z = merc.z;
    sim.run(CONTROL_TIME - 0.5);
    expect(bearer.hp).toBeLessThan(before);
    sim.run(1);
    expect(isControlled(merc)).toBe(false);
    expect(merc.side).toBe(Side.Party);
    expect(merc.hunt).toBe(Hunt.Support);
    expect(merc.order).toEqual({ x: 5, z: 5 });
  });

  it('cannot take the bearer', () => {
    const { bearer, boss } = scene();
    expect(control(boss, bearer)).toBeNull();
    expect(bearer.side).toBe(Side.Party);
  });

  it('is lifted by Cleanse', () => {
    const { sim, merc, boss } = scene();
    const cleric = spawnMerc(sim, 'cleric', 10, 12, 10);
    const cleanse = CLERIC_UPGRADES.find((u) => u.id === 'cleanse')!;
    withUpgrade(cleric, cleanse);
    const ward = cleric.skills.find((s) => s.id === 'ward') ?? WARD;
    control(boss, merc);
    ward.release(cleric, merc, sim);
    expect(isControlled(merc)).toBe(false);
    expect(merc.side).toBe(Side.Party);
  });

  it('ends when its source dies', () => {
    const { sim, merc, boss } = scene();
    control(boss, merc);
    boss.hit(boss, { kind: DamageKind.True, fixed: 99999 });
    sim.run(0.1);
    expect(merc.side).toBe(Side.Party);
  });

  it('does not count toward party wipe, morale, or kill credit', () => {
    const { sim, bearer, merc, boss } = scene();
    const other = spawnMerc(sim, 'ranger', 10, 12, 12);
    bearer.alive = false;
    other.alive = false;
    control(boss, merc);
    expect(sim.living(Side.Party)).toEqual([]);
    bearer.alive = true;
    other.alive = true;
    const morale = other.morale;
    const dead: Side[] = [];
    sim.on(SimEvents.UnitDies, 2, (e) => {
      dead.push(e.source.side);
    });
    boss.hit(merc, { kind: DamageKind.True, fixed: 99999 });
    expect(merc.alive).toBe(false);
    expect(other.morale).toBe(morale);
    // The game's listeners saw a merc, not a monster, die
    expect(dead).toEqual([Side.Party]);
    expect(merc.side).toBe(Side.Party);
  });
});

describe('skill copy', () => {
  const seen: number[] = [];
  const probe: Skill = {
    id: 'probe',
    name: 'Probe',
    describe: () => '',
    cost: 50,
    cooldown: 99,
    windup: 0.1,
    recovery: 0,
    targeting: Targeting.Self,
    wants: () => false,
    elite: () => false,
    release(u) {
      seen.push(rankOf(u, 'probe'));
    },
  };

  it('casts the last released skill at the merc rank, for no mana', () => {
    const { sim, merc, boss } = scene();
    merc.skills.push(probe);
    setRank(merc, 'probe', 4);
    expect(lastReleased(merc)).toBeNull();
    expect(copySkill(boss, merc, null)).toBe(false);
    merc.mana = 100;
    expect(merc.startCast(probe, null)).toBe(true);
    sim.run(0.2);
    expect(seen).toEqual([4]);
    expect(lastReleased(merc)?.rank).toBe(4);
    boss.mana = 0;
    expect(copySkill(boss, merc, null)).toBe(true);
    expect(seen).toEqual([4, 4]);
    expect(boss.mana).toBe(0);
    // The copy does not replace the boss's own record, and the rank is not kept
    expect(rankOf(boss, 'probe')).toBe(1);
  });
});

describe('buff theft', () => {
  it('moves duration and stacks', () => {
    const { merc, boss } = scene();
    const BRACE: StatusDef = {
      id: 'brace',
      name: 'Brace',
      duration: 8,
      immunity: 0,
      buff: true,
      maxStacks: 3,
    };
    merc.addStatus(BRACE, merc, 8, 2);
    merc.addStatus(BRACE, merc, 8, 2);
    merc.statuses.get('brace')!.remaining = 3;
    const got = stealBuff(boss, merc);
    expect(got?.stacks).toBe(2);
    expect(got?.remaining).toBe(3);
    expect(merc.statuses.has('brace')).toBe(false);
  });

  it('is not given to the controlled status', () => {
    expect(CONTROLLED.buff).toBeUndefined();
  });
});

describe('control and the rest of the game', () => {
  it('survives a stage change', () => {
    const { sim, merc, boss } = scene();
    control(boss, merc);
    const stage = generateStage(new RNG(3), 0);
    carryParty(sim, stage);
    expect(sim.units.has(merc)).toBe(true);
    expect(merc.side).toBe(Side.Party);
    expect(isControlled(merc)).toBe(false);
  });

  it('is in the save', () => {
    const { sim, merc, boss, bearer } = scene();
    control(boss, merc);
    const party = (): Unit[] => [...sim.units].filter((u) => u.side === Side.Party && u !== bearer);
    const g = {
      sim,
      bearer,
      mercs: party,
      streams: { seed: 'A', save: () => ({}) },
      eventsSeen: new Set(),
      metMiniBosses: new Set(),
      path: [],
      offers: [],
      pack: new Pack(),
      vault: new Vault(),
      director: { standing: 0 },
      encounter: null,
      node: null,
      stage: {},
    } as unknown as GameState; // oxlint-disable-line typescript/no-unsafe-type-assertion
    expect(snapshot(g).mercs).toHaveLength(1);
  });

  it('frees every controlled unit', () => {
    const { sim, merc, boss } = scene();
    control(boss, merc);
    freeControlled(sim);
    expect(merc.side).toBe(Side.Party);
  });

  it('leaves a controlled Duelist bound and unable to pick party members', () => {
    const { sim, bearer, boss } = scene();
    const duelist = spawnMerc(sim, 'duelist', 10, 12, 10);
    control(boss, duelist);
    expect(beginDuel(duelist, boss, 5)).toBe(true);
    expect(canTarget(duelist, bearer)).toBe(false);
    expect(canTarget(duelist, boss)).toBe(false);
  });

  it('keeps a hidden merc from the boss while it is controlled', () => {
    const { sim, boss } = scene();
    const hidden = spawnMerc(sim, 'sellsword', 10, 12, 10);
    hidden.hidden = true;
    expect(canTarget(boss, hidden)).toBe(false);
    const ally = spawnMerc(sim, 'ranger', 10, 13, 10);
    control(boss, ally);
    ally.hidden = true;
    expect(canTarget(boss, ally)).toBe(false);
    expect(canTarget(ally, boss)).toBe(false);
  });
});

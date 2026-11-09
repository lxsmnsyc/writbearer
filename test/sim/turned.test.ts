import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { Hunt } from '../../src/sim/ai';
import { TURN_TIME, fellTurned, freeControlled, isTurned, turn } from '../../src/sim/control';
import Sim from '../../src/sim/sim';
import { DamageKind, Rank, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

// A bearer and a merc, a mite beside them and another mite a few steps away.
function scene(): { sim: Sim; bearer: Unit; merc: Unit; mite: Unit; other: Unit } {
  const sim = field();
  const bearer = spawnBearer(sim, 10, 10);
  const merc = spawnMerc(sim, 'vanguard', 10, 11, 10);
  const mite = spawnMonster(sim, 'mite', 1, 12, 10);
  const other = spawnMonster(sim, 'mite', 1, 16, 10);
  mite.aware = true;
  other.aware = true;
  return { sim, bearer, merc, mite, other };
}

describe('turned monsters', () => {
  it('fights monsters and spares mercs for the time set, then goes back', () => {
    const { sim, bearer, merc, mite, other } = scene();
    mite.hunt = Hunt.Assassin;
    mite.target = bearer;
    expect(turn(sim, mite, 3, bearer)).not.toBeNull();
    expect(mite.side).toBe(Side.Party);
    expect(isTurned(mite)).toBe(true);
    const hurt = bearer.hp + merc.hp;
    const foe = other.hp;
    sim.run(2.9);
    expect(other.hp).toBeLessThan(foe);
    expect(bearer.hp + merc.hp).toBe(hurt);
    sim.run(0.5);
    expect(isTurned(mite)).toBe(false);
    expect(mite.side).toBe(Side.Monster);
    expect(mite.hunt).toBe(Hunt.Assassin);
    sim.run(8);
    expect(mite.target === bearer || mite.target === merc).toBe(true);
  });

  it('puts the hunt and the target back', () => {
    const { sim, bearer, mite } = scene();
    mite.hunt = Hunt.Bearer;
    mite.target = bearer;
    turn(sim, mite, 1, bearer);
    expect(mite.target).toBeNull();
    expect(mite.hunt).toBe(Hunt.Nearest);
    mite.target = null;
    freeControlled(sim);
    expect(mite.hunt).toBe(Hunt.Bearer);
    expect(mite.side).toBe(Side.Monster);
  });

  it('refuses a boss, an elite, a mini-boss, the bearer and a merc', () => {
    const { sim, bearer, merc } = scene();
    const boss = spawnMonster(sim, 'mite', 1, 30, 30);
    boss.rank = Rank.Boss;
    const elite = spawnMonster(sim, 'mite', 1, 20, 20);
    elite.rank = Rank.Elite;
    const named = spawnMonster(sim, 'mite', 1, 21, 20);
    named.named = true;
    expect(turn(sim, boss, 5, bearer)).toBeNull();
    expect(turn(sim, elite, 5, bearer)).toBeNull();
    expect(turn(sim, named, 5, bearer)).toBeNull();
    expect(turn(sim, bearer, 5, bearer)).toBeNull();
    expect(turn(sim, merc, 5, bearer)).toBeNull();
    expect(boss.side).toBe(Side.Monster);
  });

  it('cannot be stacked or refreshed by a second turn', () => {
    const { sim, bearer, merc, mite } = scene();
    expect(turn(sim, mite, 2, bearer)).not.toBeNull();
    expect(turn(sim, mite, 20, merc)).toBeNull();
    sim.run(2.3);
    expect(isTurned(mite)).toBe(false);
  });

  it('is not a party member: no wipe delay, no morale shift, no kill credit', () => {
    const { sim, bearer, merc, mite, other } = scene();
    turn(sim, mite, 5, bearer);
    expect(sim.living(Side.Party)).not.toContain(mite);
    const morale = merc.morale;
    other.hit(mite, { kind: DamageKind.True, fixed: 99999 });
    bearer.hit(other, { kind: DamageKind.True, fixed: 99999 });
    expect(mite.alive).toBe(false);
    // A monster corpse, marked so the game pays nothing for it
    expect(mite.side).toBe(Side.Monster);
    expect(fellTurned(mite)).toBe(true);
    expect(fellTurned(other)).toBe(false);
    expect(merc.morale).toBe(morale);
  });

  it('ends when the one who turned it dies', () => {
    const { sim, merc, mite } = scene();
    turn(sim, mite, 20, merc);
    merc.hit(merc, { kind: DamageKind.True, fixed: 99999 });
    sim.run(0.1);
    expect(mite.side).toBe(Side.Monster);
  });

  it('ends on a save or a stage change', () => {
    const { sim, bearer, mite } = scene();
    turn(sim, mite, 20, bearer);
    freeControlled(sim);
    expect(mite.side).toBe(Side.Monster);
    expect(TURN_TIME).toBeGreaterThan(0);
  });
});

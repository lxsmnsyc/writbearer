import { describe, expect, it } from 'vitest';
import { reveal } from '../../src/content/creditor';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import {
  addRestGuard,
  canRaise,
  corpsesNear,
  isCorpse,
  isRested,
  layToRest,
} from '../../src/sim/corpse';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function fallen(sim: Sim, blow = 1): Unit {
  const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
  merc.hp = 1;
  spawnMonster(sim, 'mite', 1, 11, 10).hit(merc, { kind: DamageKind.True, fixed: blow });
  return merc;
}

describe('corpses', () => {
  it('raises a plain corpse', () => {
    const sim = new Sim(1);
    const merc = fallen(sim);
    expect(isCorpse(merc)).toBe(true);
    expect(canRaise(merc)).toBe(true);
    expect(merc.revive(0.5)).toBe(true);
    expect(merc.alive).toBe(true);
  });

  it('does not raise a torn body', () => {
    const sim = new Sim(1);
    const merc = fallen(sim, 9999);
    expect(merc.torn).toBe(true);
    expect(canRaise(merc)).toBe(false);
    expect(merc.revive(0.5)).toBe(false);
  });

  it('lays to rest once and stays dead', () => {
    const sim = new Sim(1);
    const merc = fallen(sim);
    let seen = 0;
    sim.on(SimEvents.UnitLaidToRest, 0, () => {
      seen += 1;
    });
    expect(layToRest(merc)).toBe(true);
    expect(layToRest(merc)).toBe(false);
    expect(seen).toBe(1);
    expect(isRested(merc)).toBe(true);
    expect(merc.revive(0.5)).toBe(false);
    expect(merc.alive).toBe(false);
  });

  it('obeys a guard until it is removed', () => {
    const sim = new Sim(1);
    const merc = fallen(sim);
    const guard = addRestGuard(sim, () => true);
    guard.start();
    expect(canRaise(merc)).toBe(false);
    expect(merc.revive(0.5)).toBe(false);
    guard.stop();
    expect(merc.revive(0.5)).toBe(true);
  });

  it('is not a corpse when the unit left without dying', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    merc.alive = false;
    sim.units.delete(merc);
    expect(isCorpse(merc)).toBe(false);
    expect(canRaise(merc)).toBe(false);
    expect(layToRest(merc)).toBe(false);
  });

  it('finds corpses of a side near a point', () => {
    const sim = new Sim(1);
    const merc = fallen(sim);
    expect(corpsesNear(sim, Side.Party, { x: 10, z: 10 }, 2)).toEqual([merc]);
    expect(corpsesNear(sim, Side.Party, { x: 30, z: 10 }, 2)).toEqual([]);
    expect(corpsesNear(sim, Side.Monster, { x: 10, z: 10 }, 2)).toEqual([]);
  });

  it('keeps a rested merc dead at the reveal', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 15, 12);
    const rested = fallen(sim);
    const open = fallen(sim);
    layToRest(rested);
    const r = reveal(sim, bearer, 36, 0);
    expect(r.raised).toEqual([open]);
    expect(rested.alive).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster, spawnRefugee } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import ObjectiveRun from '../../src/game/objective';
import { generateStage } from '../../src/gen/stage';
import { DEFAULT_TOGGLES, Stance } from '../../src/sim/ai';
import { markKidnapper } from '../../src/sim/ai/kidnapper';
import { SimEvents } from '../../src/sim/events';
import { heldBy, isHeld } from '../../src/sim/grab';
import Sim from '../../src/sim/sim';
import { ROOTED, STUN } from '../../src/sim/statuses';
import { DamageKind } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

interface Rig {
  sim: Sim;
  bearer: Unit;
  wards: Unit[];
  kidnapper: Unit;
  deaths: number;
}

// An Escort field 40 wide with an exit at the far end, wards away from the
// bearer and a test kidnapper between.
function rig(wards = 2): Rig {
  const sim = new Sim(1);
  sim.setFloor(40, 20);
  sim.pocket = {
    pick: () => null,
    take: () => {},
    give: () => {},
    exits: () => [{ x: 38, z: 10 }],
  };
  const bearer = spawnBearer(sim, 3, 18);
  const list: Unit[] = [];
  for (let i = 0; i < wards; i++) {
    list.push(spawnRefugee(sim, 1, 24, 6 + i * 4));
  }
  const kidnapper = spawnMonster(sim, 'mite', 1, 16, 10);
  markKidnapper(kidnapper);
  kidnapper.aware = true;
  const r: Rig = { sim, bearer, wards: list, kidnapper, deaths: 0 };
  sim.on(SimEvents.UnitDies, 0, () => {
    r.deaths++;
  });
  return r;
}

// Whom the kidnapper holds, failing the test if nobody
function held(r: Rig): Unit {
  const victim = heldBy(r.kidnapper);
  if (!victim) {
    throw new Error('nobody is held');
  }
  return victim;
}

function escort(): ObjectiveRun {
  const stage = generateStage(new RNG(4), 3, {
    kind: 'combat',
    ahead: ['combat'],
    objective: 'escort',
  });
  return new ObjectiveRun('escort', stage);
}

function runUntil(sim: Sim, done: () => boolean): void {
  for (let i = 0; i < 4000 && !done(); i++) {
    sim.tick(DT);
  }
}

describe('kidnappers', () => {
  it('drags a ward off the map and the Escort counts it lost', () => {
    const r = rig(1);
    const run = escort();
    run.update(r.sim, DT, 1);
    runUntil(r.sim, () => heldBy(r.kidnapper) !== null);
    const victim = held(r);
    runUntil(r.sim, () => !r.kidnapper.alive);
    expect(r.kidnapper.alive).toBe(false);
    expect(victim.alive).toBe(false);
    expect(r.sim.units.has(victim)).toBe(false);
    expect(r.deaths).toBe(0);
    // The only ward is gone, below the need of one
    run.update(r.sim, DT, 1);
    expect(run.failed).toBe(true);
  });

  it('does not fail an Escort that still has enough wards', () => {
    const r = rig(2);
    const run = escort();
    run.update(r.sim, DT, 1);
    runUntil(r.sim, () => !r.kidnapper.alive);
    run.update(r.sim, DT, 1);
    expect(r.wards.filter((w) => w.alive)).toHaveLength(1);
    expect(run.failed).toBe(false);
  });

  it('drops the ward where it stands when stunned mid-drag', () => {
    const r = rig(1);
    runUntil(r.sim, () => heldBy(r.kidnapper) !== null);
    const ward = held(r);
    for (let i = 0; i < 20; i++) {
      r.sim.tick(DT);
    }
    r.kidnapper.addStatus(STUN, r.bearer);
    expect(heldBy(r.kidnapper)).toBeNull();
    expect(ward.alive).toBe(true);
    expect(isHeld(ward)).toBe(false);
    expect(ward.disabled).toBe(false);
  });

  it('drops the ward with its health when killed', () => {
    const r = rig(1);
    runUntil(r.sim, () => heldBy(r.kidnapper) !== null);
    const ward = held(r);
    const hp = ward.hp;
    const at = { x: ward.x, z: ward.z };
    r.bearer.hit(r.kidnapper, { kind: DamageKind.True, fixed: 9999 });
    expect(r.kidnapper.alive).toBe(false);
    expect(ward.alive).toBe(true);
    expect(ward.hp).toBe(hp);
    expect({ x: ward.x, z: ward.z }).toEqual(at);
    expect(isHeld(ward)).toBe(false);
    expect(ward.disabled).toBe(false);
  });

  it('fights a Guard merc in its line instead of walking through', () => {
    const r = rig(1);
    runUntil(r.sim, () => heldBy(r.kidnapper) !== null);
    const merc = spawnMerc(r.sim, 'vanguard', 1, r.kidnapper.x + 0.8, r.kidnapper.z, {
      ...DEFAULT_TOGGLES,
      stance: Stance.Guard,
    });
    const before = merc.hp;
    // The merc holds its ground
    merc.addStatus(ROOTED, r.bearer, 10);
    // While the merc stands, the kidnapper stays on its near side
    let past = false;
    for (let i = 0; i < 40 && merc.alive; i++) {
      r.sim.tick(DT);
      past ||= r.kidnapper.x > merc.x;
    }
    expect(merc.hp < before || !merc.alive).toBe(true);
    expect(past).toBe(false);
  });

  it('fights like a normal melee monster with no ward in the area', () => {
    const r = rig(0);
    runUntil(r.sim, () => r.bearer.hp < r.bearer.derived.maxHp);
    expect(r.bearer.hp).toBeLessThan(r.bearer.derived.maxHp);
    expect(r.kidnapper.alive).toBe(true);
    expect(heldBy(r.kidnapper)).toBeNull();
  });

  it('lets go of a hold when the area changes', () => {
    const r = rig(1);
    runUntil(r.sim, () => heldBy(r.kidnapper) !== null);
    const ward = held(r);
    r.sim.area++;
    expect(heldBy(r.kidnapper)).toBeNull();
    expect(isHeld(ward)).toBe(false);
    expect(ward.disabled).toBe(false);
  });
});

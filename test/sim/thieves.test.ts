import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { RunStreams } from '../../src/core/seed';
import watchTheft from '../../src/game/game/theft';
import { type GroundItem, Pack } from '../../src/game/inventory';
import ObjectiveRun from '../../src/game/objective';
import { generateStage } from '../../src/gen/stage';
import { loadItem, saveItem } from '../../src/game/save';
import { rollItem } from '../../src/gen/loot';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { STUN } from '../../src/sim/statuses';
import { carried, markThief } from '../../src/sim/theft';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

interface Rig {
  sim: Sim;
  pack: Pack;
  ground: GroundItem[];
  bearer: Unit;
  thief: Unit;
  deaths: number;
  lines: string[];
}

// A bearer with a pack of `items` and `gold`, and a thief close by. The
// exit is at the far end of the floor.
function rig(items: number, gold = 0): Rig {
  const sim = new Sim(1);
  sim.setFloor(40, 20);
  const pack = new Pack();
  const rng = new RNG(5);
  for (let i = 0; i < items; i++) {
    pack.add(rollItem(rng, 10));
  }
  pack.gold = gold;
  const ground: GroundItem[] = [];
  const lines: string[] = [];
  const bearer = spawnBearer(sim, 10, 10);
  const thief = spawnMonster(sim, 'mite', 1, 13, 10);
  markThief(thief);
  thief.aware = true;
  const g = {
    sim,
    pack,
    ground,
    stageIndex: 0,
    streams: new RunStreams('TESTSEED'),
    stage: { exits: [{ x: 38, z: 10 }] },
    itemsChanged: () => {},
    say: (line: string) => lines.push(line),
  };
  watchTheft(g);
  const r: Rig = { sim, pack, ground, bearer, thief, deaths: 0, lines };
  sim.on(SimEvents.UnitDies, 0, () => {
    r.deaths++;
  });
  return r;
}

function runUntil(sim: Sim, done: () => boolean): void {
  for (let i = 0; i < 2000 && !done(); i++) {
    sim.tick(DT);
  }
}

describe('thieves', () => {
  it('takes one item from the pack and runs for the exit', () => {
    const r = rig(3);
    const before = [...r.pack.items];
    runUntil(r.sim, () => carried(r.thief) !== null);
    expect(carried(r.thief)).not.toBeNull();
    expect(r.pack.items).toHaveLength(2);
    const lost = before.filter((i) => !r.pack.items.includes(i));
    expect(lost).toHaveLength(1);
    runUntil(r.sim, () => !r.thief.alive);
    expect(r.thief.alive).toBe(false);
    expect(r.sim.units.has(r.thief)).toBe(false);
    expect(r.deaths).toBe(0);
    expect(r.pack.items).toHaveLength(2);
    expect(r.ground).toHaveLength(0);
    expect(r.lines.length).toBeGreaterThan(0);
  });

  it('drops the item where it dies, and the pack can hold it again', () => {
    const r = rig(3);
    runUntil(r.sim, () => carried(r.thief) !== null);
    const loot = carried(r.thief);
    const taken = loot && 'item' in loot ? loot.item : null;
    r.bearer.hit(r.thief, { kind: 0, fixed: 999 });
    runUntil(r.sim, () => !r.thief.alive);
    expect(r.deaths).toBe(1);
    expect(r.ground.map((g) => g.item)).toEqual([taken]);
    expect(r.pack.add(r.ground[0].item)).toBe(true);
    expect(r.pack.items).toHaveLength(3);
  });

  it('is stopped by a stun', () => {
    const r = rig(3);
    runUntil(r.sim, () => carried(r.thief) !== null);
    r.thief.addStatus(STUN, r.bearer);
    const at = r.thief.x;
    for (let i = 0; i < 10; i++) {
      r.sim.tick(DT);
    }
    expect(r.thief.x).toBe(at);
  });

  it('takes gold only when the pack has no item, and never all of it', () => {
    const r = rig(0, 100);
    runUntil(r.sim, () => carried(r.thief) !== null);
    expect(r.pack.gold).toBeGreaterThan(0);
    expect(r.pack.gold).toBeLessThan(100);
    expect(r.pack.gold).toBe(75);
    r.bearer.hit(r.thief, { kind: 0, fixed: 999 });
    runUntil(r.sim, () => !r.thief.alive);
    expect(r.ground[0].item.quantity).toBe(25);
  });

  it('does nothing with an empty pack and fights like any monster', () => {
    const r = rig(0, 0);
    runUntil(r.sim, () => r.bearer.hp < r.bearer.derived.maxHp);
    expect(carried(r.thief)).toBeNull();
    expect(r.thief.alive).toBe(true);
    expect(r.bearer.hp).toBeLessThan(r.bearer.derived.maxHp);
  });

  it('never duplicates an item across a save', () => {
    const r = rig(3);
    const all = r.pack.items.map((i) => i.base.id).sort((a, b) => a.localeCompare(b));
    runUntil(r.sim, () => carried(r.thief) !== null);
    // Saved after the theft: the item is missing
    const afterTheft = r.pack.items.map((i) => saveItem(i));
    expect(afterTheft).toHaveLength(2);
    // Recovered, then saved: the item is back, once
    r.bearer.hit(r.thief, { kind: 0, fixed: 999 });
    runUntil(r.sim, () => !r.thief.alive);
    const back = r.ground.pop();
    expect(back).toBeDefined();
    if (back) {
      r.pack.add(back.item);
    }
    const saved = r.pack.items.map((i) => saveItem(i));
    const loaded = saved.map((s) => loadItem(s)?.base.id ?? '').sort((a, b) => a.localeCompare(b));
    expect(loaded).toEqual(all);
  });

  it('does not leave a Hunt waiting for a thief that got away', () => {
    const r = rig(3);
    const stage = generateStage(new RNG(3), 2, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'hunt',
    });
    const hunt = new ObjectiveRun('hunt', stage);
    r.thief.marked = true;
    expect(hunt.update(r.sim, DT, 5)).toBe(false);
    runUntil(r.sim, () => !r.thief.alive);
    expect(r.thief.alive).toBe(false);
    expect(hunt.update(r.sim, DT, 5)).toBe(true);
  });
});

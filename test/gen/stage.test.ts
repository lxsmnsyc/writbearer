import { describe, expect, it } from 'vitest';
import { spawnBearer } from '../../src/content/roster';
import { AREAS_PER_LAYER, layerOf } from '../../src/gen/layers';
import RNG from '../../src/core/rng';
import { RunStreams, Stream } from '../../src/core/seed';
import { type Stage, generateStage, navFor } from '../../src/gen/stage';
import { carryParty, enterStage, spawnParty } from '../../src/game/stage';
import Nav from '../../src/sim/nav';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';

const SEEDS = ['ASHEN', 'K7Q2M9PX', 'WRIT', '00000000', 'HOLLOW', 'CREDITOR'];

const stageFor = (seed: string, index = 0): Stage =>
  generateStage(new RunStreams(seed).area(1, Stream.Layout, index), index);

describe('nav', () => {
  // A wall along x = 5 from z = 0 to 8, open above z = 8.
  const wall = Array.from({ length: 9 }, (_, i) => ({ x: 5, z: i, r: 0.5 }));
  const nav = new Nav(12, 12, wall);

  it('sees a straight walk in the open, and not through a wall', () => {
    expect(nav.clear(1, 10, 9, 10)).toBe(true);
    expect(nav.clear(1, 2, 9, 2)).toBe(false);
  });

  it('finds a way around a wall', () => {
    const path = nav.path({ x: 1, z: 2 }, { x: 9, z: 2 });
    expect(path.at(-1)).toEqual({ x: 9, z: 2 });
    expect(Math.max(...path.map((p) => p.z))).toBeGreaterThan(8);
  });

  it('walks a unit around the wall to its order', () => {
    const sim = new Sim(1);
    sim.obstacles.push(...wall);
    sim.setFloor(12, 12);
    const bearer = spawnBearer(sim, 1, 2);
    bearer.order = { x: 9, z: 2 };
    sim.run(20, () => bearer.order === null);
    expect(bearer.distanceTo({ x: 9, z: 2 })).toBeLessThan(0.1);
  });
});

describe('stage generation', () => {
  it('builds the same stage from the same seed', () => {
    expect(stageFor('ASHEN')).toEqual(stageFor('ASHEN'));
    expect(stageFor('ASHEN')).not.toEqual(stageFor('WRIT'));
    expect(stageFor('ASHEN', 1)).not.toEqual(stageFor('ASHEN', 0));
  });

  it('keeps a stage within the size the design gives', () => {
    for (const seed of SEEDS) {
      const s = stageFor(seed);
      expect(s.width).toBeGreaterThanOrEqual(48);
      expect(s.width).toBeLessThanOrEqual(64);
      expect(s.depth).toBeGreaterThanOrEqual(32);
      expect(s.depth).toBeLessThanOrEqual(48);
      // The entrance and the exit sit on opposite sides.
      expect(s.exit.x - s.entrance.x).toBeGreaterThan(s.width * 0.8);
    }
  });

  it('lets the bearer reach the exit and every pack', () => {
    for (const seed of SEEDS) {
      const s = stageFor(seed);
      const nav = navFor(s);
      for (const goal of [s.exit, ...s.packs]) {
        const end = nav.path(s.entrance, goal).at(-1);
        expect(end, `${seed}: ${goal.x},${goal.z}`).toBeDefined();
        expect(Math.hypot(end!.x - goal.x, end!.z - goal.z)).toBeLessThan(2.5);
      }
    }
  });

  it('blocks the field with a wall, so the way through is a choke point', () => {
    for (const seed of SEEDS) {
      const s = stageFor(seed);
      const nav = navFor(s);
      const wall = s.props.filter((p) => p.kind === 'wall');
      expect(wall.length).toBeGreaterThan(20);
      // No one walks straight across the wall, except through a breach.
      for (const w of wall) {
        expect(nav.clear(w.x - 1.5, w.z, w.x + 1.5, w.z)).toBe(false);
      }
    }
  });

  it('places a Church site, a lair with an elite deeper in, and keeps packs off the entrance', () => {
    for (const seed of SEEDS) {
      const s = stageFor(seed, 4);
      expect(s.props.some((p) => p.kind === 'altar')).toBe(true);
      expect(s.packs.some((p) => p.kinds.includes('cantor'))).toBe(true);
      expect(s.packs.some((p) => p.elite >= 0)).toBe(true);
      for (const p of s.packs) {
        expect(Math.hypot(p.x - s.entrance.x, p.z - s.entrance.z)).toBeGreaterThan(10);
      }
    }
  });

  it('fields only weak monsters on the first stages', () => {
    for (const seed of SEEDS) {
      for (const index of [0, 1]) {
        const kinds = stageFor(seed, index).packs.flatMap((p) => p.kinds);
        expect(kinds.every((k) => ['mite', 'husk', 'penitent'].includes(k))).toBe(true);
        expect(stageFor(seed, index).packs.every((p) => p.elite < 0)).toBe(true);
      }
    }
  });

  it('grows the threat budget deeper in', () => {
    const count = (index: number): number =>
      SEEDS.reduce((n, seed) => n + stageFor(seed, index).packs.flatMap((p) => p.kinds).length, 0);
    expect(count(4)).toBeGreaterThan(count(0));
  });

  it('leads on by road inside a layer, and down only from its last area', () => {
    for (let index = 0; index < AREAS_PER_LAYER * 2; index++) {
      const s = stageFor('ASHEN', index);
      const down = index % AREAS_PER_LAYER === AREAS_PER_LAYER - 1;
      expect(s.down).toBe(down);
      expect(s.props.some((p) => p.kind === 'stair')).toBe(down);
      expect(s.props.some((p) => p.kind === 'signpost')).toBe(!down);
    }
    expect(layerOf(0).name).toBe('The Marches');
    expect(layerOf(AREAS_PER_LAYER).name).toBe('The Rift Road');
  });

  it('builds from its own stream only', () => {
    const a = generateStage(new RNG(5), 0);
    const b = generateStage(new RNG(5), 0);
    expect(a).toEqual(b);
  });
});

describe('crossing to the next stage', () => {
  it('walks the bearer to the exit, then brings the party, dead and alive, to the next entrance', () => {
    const first = stageFor('ASHEN', 0);
    const sim = new Sim(1);
    const bearer = spawnParty(sim, first);
    enterStage(sim, first);
    // A quiet walk: the packs are removed, so only the field is tested.
    for (const u of sim.living(Side.Monster)) {
      sim.units.delete(u);
    }
    const [vanguard, ranger] = [...sim.units].filter((u) => u !== bearer);
    ranger.die(null);
    bearer.order = { ...first.exit };
    sim.run(120, () => bearer.order === null);
    expect(bearer.distanceTo(first.exit)).toBeLessThan(0.5);

    const next = stageFor('ASHEN', 1);
    carryParty(sim, next);
    enterStage(sim, next);
    expect(bearer.distanceTo(next.entrance)).toBeLessThan(1);
    expect(vanguard.distanceTo(next.entrance)).toBeLessThan(2);
    expect(sim.units.has(ranger)).toBe(true);
    expect(sim.living(Side.Monster).length).toBe(next.packs.flatMap((p) => p.kinds).length);
  });
});

import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import Flow from '../../src/sim/flow';
import type { Objective } from '../../src/gen/graph';
import { placeStage } from '../../src/gen/place';
import { type Stage, generateStage, navFor, rectOf } from '../../src/gen/stage';

const OPEN_FIELD: Objective[] = ['hunt', 'horde', 'escort', 'vault', 'ritual', 'collapse'];

const field = (seed: number, objective: Objective, index = 10): Stage =>
  generateStage(new RNG(seed), index, { kind: 'combat', ahead: ['combat', 'camp'], objective });

const flowOf = (s: Stage): Flow => {
  const nav = navFor(s);
  return new Flow(rectOf(s), s.entrance, (x, z) => nav.walkable(x, z));
};

describe('an area’s flow', () => {
  it('is nothing at the entrance and grows toward the exits', () => {
    const s = field(1, 'hunt');
    const flow = flowOf(s);
    expect(flow.at(s.entrance)).toBe(0);
    for (const e of s.exits) {
      const d = flow.at(e);
      expect(d).toBeGreaterThan(20);
      expect(d).toBeLessThanOrEqual(flow.max);
      expect(d).toBeGreaterThanOrEqual(Math.hypot(e.x - s.entrance.x, e.z - s.entrance.z) - 1);
    }
    expect(flow.progress(s.entrance)).toBe(0);
  });

  it('walks round what blocks the way, and cannot reach a shut-off tile', () => {
    // A wall across the middle with one gap at the top
    const walkable = (x: number, z: number): boolean => !(x > 9 && x < 11 && z > 3);
    const flow = new Flow({ x0: 0, z0: 0, x1: 20, z1: 20 }, { x: 2.5, z: 15.5 }, walkable);
    const across = flow.at({ x: 15.5, z: 15.5 });
    expect(across).toBeGreaterThan(20);
    const shut = new Flow({ x0: 0, z0: 0, x1: 20, z1: 20 }, { x: 2.5, z: 2.5 }, (x) => x < 9);
    expect(shut.at({ x: 15.5, z: 15.5 })).toBe(Infinity);
    expect(shut.progress({ x: 15.5, z: 15.5 })).toBe(0);
  });
});

describe('an open field’s key points', () => {
  it('has spawn, boss and relief spots on open ground the party can reach, clear of the entrance', () => {
    for (const objective of OPEN_FIELD) {
      for (let seed = 1; seed <= 8; seed++) {
        for (const index of [2, 10, 18, 26]) {
          const s = field(seed, objective, index);
          const spots = s.spots ?? [];
          const count = (k: string): number => spots.filter((p) => p.kind === k).length;
          const tag = `${objective} ${seed} ${index}`;
          expect(count('spawn'), tag).toBeGreaterThanOrEqual(4);
          expect(count('boss'), tag).toBeGreaterThanOrEqual(1);
          expect(count('relief'), tag).toBeGreaterThanOrEqual(2);
          const flow = flowOf(s);
          for (const p of spots) {
            expect(Number.isFinite(flow.at(p)), tag).toBe(true);
          }
          for (const p of spots.filter((q) => q.kind === 'spawn')) {
            expect(Math.hypot(p.x - s.entrance.x, p.z - s.entrance.z)).toBeGreaterThanOrEqual(6);
          }
        }
      }
    }
  });

  it('lays its boss spots along the way, nearest the entrance first', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = field(seed, 'hunt');
      const flow = flowOf(s);
      const along = (s.spots ?? []).filter((p) => p.kind === 'boss').map((p) => flow.at(p));
      expect(along.length).toBeGreaterThanOrEqual(2);
      expect(along.at(-1)!).toBeGreaterThan(along[0]);
    }
  });

  it('gives an Ambush its groups’ spots and relief by the fire', () => {
    const s = field(3, 'ambush');
    const spawns = (s.spots ?? []).filter((p) => p.kind === 'spawn');
    expect(spawns).toEqual((s.waves ?? []).map((w) => ({ kind: 'spawn', ...w.from })));
    expect((s.spots ?? []).filter((p) => p.kind === 'relief')).toHaveLength(2);
  });

  it('moves with its area as it is laid in the world', () => {
    const s = field(4, 'hunt');
    const first = { ...s.spots![0] };
    placeStage(s, { x: 0, z: 1 }, { x: 100, z: 50 });
    expect(s.spots![0].x).toBeCloseTo(100 - first.z);
    expect(s.spots![0].z).toBeCloseTo(50 + first.x);
  });
});

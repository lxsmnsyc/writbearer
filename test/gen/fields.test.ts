import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import { type Stage, generateStage, holesOf, navFor, solidsOf } from '../../src/gen/stage';
import Nav, { type Spot } from '../../src/sim/nav';

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

const field = (seed: number, layer: number): Stage =>
  generateStage(new RNG(seed), layer * AREAS_PER_LAYER + 2, {
    kind: 'combat',
    ahead: ['combat', 'camp'],
    sides: ['north', 'east'],
  });

// Whether a path gets within `near` of a place. A solid one, such as an
// altar, is reached beside it.
const reaches = (nav: Nav, from: Spot, to: Spot, near = 1.5): boolean => {
  const end = nav.path(from, to).at(-1);
  return end !== undefined && Math.hypot(end.x - to.x, end.z - to.z) < near;
};

// The point halfway along a route, by distance.
function halfway(route: Spot[]): Spot {
  const legs = route.slice(1).map((b, i) => Math.hypot(b.x - route[i].x, b.z - route[i].z));
  let left = legs.reduce((n, l) => n + l, 0) / 2;
  for (const [i, l] of legs.entries()) {
    if (left <= l) {
      const t = left / (l || 1);
      const a = route[i];
      const b = route[i + 1];
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    left -= l;
  }
  return route[route.length - 1];
}

describe('an open field', () => {
  it('takes its layer’s ground plan', () => {
    const plans = (layer: number): Set<string | undefined> =>
      new Set(SEEDS.map((seed) => field(seed, layer).layout));
    expect([...plans(0)]).toEqual(['grove']);
    expect([...plans(1)].sort((a, b) => String(a).localeCompare(String(b)))).toEqual([
      'bridges',
      'cavern',
    ]);
    expect([...plans(2)].sort((a, b) => String(a).localeCompare(String(b)))).toEqual([
      'cavern',
      'halls',
    ]);
    expect([...plans(3)]).toEqual(['halls']);
  });

  it('can be crossed to every exit and place, whatever its plan', () => {
    for (const layer of [0, 1, 2, 3]) {
      for (const seed of SEEDS) {
        const s = field(seed, layer);
        const nav = navFor(s);
        for (const e of s.exits) {
          expect(reaches(nav, s.entrance, e), `${s.layout} ${seed}`).toBe(true);
        }
        for (const p of [...s.sigils, ...s.packs]) {
          expect(reaches(nav, s.entrance, p, 2.5), `${s.layout} ${seed}`).toBe(true);
        }
      }
    }
  });

  it('has a second way across where the first is blocked, but over the chasm', () => {
    for (const layer of [0, 1, 2, 3]) {
      for (const seed of SEEDS) {
        const s = field(seed, layer);
        if (s.layout === 'bridges') {
          continue;
        }
        const mid = halfway([s.entrance, ...navFor(s).path(s.entrance, s.exits[1])]);
        const blocked = new Nav(s.width, s.depth, [
          ...solidsOf(s),
          ...holesOf(s),
          { x: mid.x, z: mid.z, r: 2.5 },
        ]);
        expect(reaches(blocked, s.entrance, s.exits[1]), `${s.layout} ${seed}`).toBe(true);
      }
    }
  });

  it('lays a chasm only on the bridges plan, with ground under the way in and out', () => {
    for (const seed of SEEDS) {
      const s = field(seed, 1);
      expect((s.chasm ?? []).length > 0).toBe(s.layout === 'bridges');
      for (const c of s.chasm ?? []) {
        expect(Math.hypot(c.x - s.entrance.x, c.z - s.entrance.z)).toBeGreaterThan(4);
      }
    }
  });
});

describe('the ground of an open field', () => {
  it('has water above and below, embers on the Rift Road and in the Crown, blossoms on every layer', () => {
    for (const [layer, want] of [
      [0, { water: true, embers: false }],
      [1, { water: false, embers: true }],
      [2, { water: true, embers: false }],
      [3, { water: true, embers: true }],
    ] as const) {
      const fields = SEEDS.map((seed) => field(seed, layer));
      const has = (kind: string): boolean =>
        fields.some((s) => (s.patches ?? []).some((p) => p.kind === kind));
      expect(has('water')).toBe(want.water);
      expect(has('embers')).toBe(want.embers);
      expect(fields.every((s) => s.props.some((p) => p.kind === 'blossom'))).toBe(true);
    }
  });

  it('keeps embers off the roads, and the entrance and exits clear', () => {
    for (const layer of [0, 1, 2, 3]) {
      for (const seed of SEEDS) {
        const stage = field(seed, layer);
        for (const p of stage.patches ?? []) {
          for (const e of [stage.entrance, ...stage.exits]) {
            expect(Math.hypot(e.x - p.x, e.z - p.z)).toBeGreaterThan(p.r);
          }
          const roads = p.kind === 'embers' ? stage.roads.flat() : [];
          for (const q of roads) {
            expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(p.r);
          }
        }
      }
    }
  });

  it('grows its blossoms where the party can walk to them', () => {
    for (const layer of [0, 1, 2, 3]) {
      for (const seed of SEEDS) {
        const stage = field(seed, layer);
        const nav = navFor(stage);
        for (const b of stage.props.filter((p) => p.kind === 'blossom')) {
          expect(reaches(nav, stage.entrance, b, 0.9)).toBe(true);
        }
      }
    }
  });
});

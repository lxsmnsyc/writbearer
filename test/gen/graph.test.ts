import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { generateLayerMap } from '../../src/gen/graph';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import { THREAT, generateStage, navFor } from '../../src/gen/stage';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe('a layer map', () => {
  it('has a column per area, ending at the boss, with a Camp just before', () => {
    for (const seed of SEEDS) {
      const { columns } = generateLayerMap(new RNG(seed));
      expect(columns).toHaveLength(AREAS_PER_LAYER);
      expect(columns[0]).toHaveLength(2);
      expect(columns.at(-1)!.map((n) => n.kind)).toEqual(['boss']);
      expect(columns.at(-2)!.some((n) => n.kind === 'camp')).toBe(true);
    }
  });

  it('gives every area a way in and at most two ways out, and no roads cross', () => {
    for (const seed of SEEDS) {
      const { columns } = generateLayerMap(new RNG(seed));
      for (let c = 0; c < columns.length - 1; c++) {
        const from = columns[c];
        const to = columns[c + 1];
        for (const node of from) {
          expect(node.next.length).toBeGreaterThanOrEqual(1);
          expect(node.next.length).toBeLessThanOrEqual(2);
        }
        to.forEach((_, j) => {
          expect(from.some((n) => n.next.includes(j))).toBe(true);
        });
        for (let i = 1; i < from.length; i++) {
          expect(Math.max(...from[i - 1].next)).toBeLessThanOrEqual(Math.min(...from[i].next));
        }
      }
    }
  });

  it('never joins two Camps, two Elites or two Events by a road', () => {
    for (const seed of SEEDS) {
      const { columns } = generateLayerMap(new RNG(seed));
      columns.forEach((column, c) => {
        for (const node of column) {
          for (const j of node.next) {
            const next = columns[c + 1][j];
            if (node.kind === 'camp' || node.kind === 'elite' || node.kind === 'event') {
              expect(next.kind).not.toBe(node.kind);
            }
          }
        }
      });
    }
  });

  it('opens with one area where the run begins, still joined throughout', () => {
    for (const seed of SEEDS) {
      const { columns } = generateLayerMap(new RNG(seed), 1);
      expect(columns[0]).toHaveLength(1);
      expect(columns[0][0].next).toEqual(columns[1].map((_, j) => j));
    }
  });

  it('is the same for the same stream', () => {
    expect(generateLayerMap(new RNG(9))).toEqual(generateLayerMap(new RNG(9)));
  });
});

describe('areas on the map', () => {
  it('fork into two roads, each with its signpost, both reachable', () => {
    const stage = generateStage(new RNG(4), 3, { kind: 'combat', ahead: ['elite', 'camp'] });
    expect(stage.exits.map((e) => e.ahead)).toEqual(['elite', 'camp']);
    expect(stage.props.filter((p) => p.kind === 'signpost')).toHaveLength(2);
    const nav = navFor(stage);
    for (const e of stage.exits) {
      const end = nav.path(stage.entrance, e).at(-1)!;
      expect(Math.hypot(end.x - e.x, end.z - e.z)).toBeLessThan(1);
    }
  });

  it('hold a bigger budget and an elite in an Elite area, even early', () => {
    const threat = (kind: 'combat' | 'elite'): number => {
      let sum = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const s = generateStage(new RNG(seed), 2, { kind, ahead: ['combat'] });
        // An elite counts as six more, as the budget counts it.
        sum += s.packs.flatMap((p) => p.kinds).reduce((n, k) => n + THREAT[k], 0);
        sum += s.packs.filter((p) => p.elite >= 0).length * 6;
        if (kind === 'elite') {
          expect(s.packs.some((p) => p.elite >= 0)).toBe(true);
        }
      }
      return sum;
    };
    expect(threat('elite')).toBeGreaterThan(threat('combat'));
  });

  it('make a Camp safe, with a fire to rest by, and a merc to hire only in endless mode', () => {
    const stage = generateStage(new RNG(5), 4, { kind: 'camp', ahead: ['combat', 'elite'] });
    expect(stage.packs).toHaveLength(0);
    expect(stage.rest).toBeDefined();
    expect(stage.recruit).toBeUndefined();
    expect(stage.exits).toHaveLength(2);
    const endless = generateStage(new RNG(5), 4, {
      kind: 'camp',
      ahead: ['combat'],
      endless: true,
    });
    expect(endless.recruit).toBeDefined();
  });
});

describe('endless phases', () => {
  it('lay an area out on another layer’s ground and monsters', () => {
    const marches = generateStage(new RNG(6), 40, { kind: 'combat', ahead: ['combat'], biome: 0 });
    const crown = generateStage(new RNG(6), 40, { kind: 'combat', ahead: ['combat'], biome: 3 });
    expect(marches.biome).toBe(0);
    expect(marches.props.some((p) => p.kind === 'tree')).toBe(true);
    expect(crown.props.some((p) => p.kind === 'tree')).toBe(false);
    const kinds = (s: typeof crown): Set<string> => new Set(s.packs.flatMap((p) => p.kinds));
    expect(kinds(crown).has('mite')).toBe(false);
    expect(kinds(crown).has('hollowed')).toBe(true);
    const arena = generateStage(new RNG(6), 47, { kind: 'boss', ahead: ['down'], biome: 1 });
    expect(arena.biome).toBe(1);
  });

  it('offer mercs at any depth, where the story has no one left to hire', () => {
    const plan = { kind: 'camp', ahead: ['combat'] } as const;
    expect(generateStage(new RNG(2), 30, { ...plan, ahead: ['combat'] }).recruit).toBeUndefined();
    expect(
      generateStage(new RNG(2), 30, { ...plan, ahead: ['combat'], endless: true }).recruit,
    ).toBeDefined();
  });
});

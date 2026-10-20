import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { generateLayerMap } from '../../src/gen/graph';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import { THREAT, generateStage, navFor, rectOf } from '../../src/gen/stage';
import { placeBeyond } from '../../src/gen/place';
import { sidesToward } from '../../src/game/game';

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

  it('gives every area a way in and at most two ways out, each to a room beside it', () => {
    for (const seed of SEEDS) {
      const { columns, start } = generateLayerMap(new RNG(seed));
      const cells = [start, ...columns.flat().map((n) => n.cell)];
      expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(cells.length);
      for (const node of columns[0]) {
        expect(Math.abs(node.cell.x - start.x) + Math.abs(node.cell.y - start.y)).toBe(1);
      }
      for (let c = 0; c < columns.length - 1; c++) {
        const from = columns[c];
        const to = columns[c + 1];
        for (const node of from) {
          expect(node.next.length).toBeGreaterThanOrEqual(1);
          expect(node.next.length).toBeLessThanOrEqual(2);
          for (const j of node.next) {
            const d = Math.abs(to[j].cell.x - node.cell.x) + Math.abs(to[j].cell.y - node.cell.y);
            expect(d).toBe(1);
          }
        }
        to.forEach((_, j) => {
          expect(from.some((n) => n.next.includes(j))).toBe(true);
        });
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

describe('the world', () => {
  it('turns as the layer’s plan shows: each area lies the way its room does', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const map = generateLayerMap(new RNG(seed));
      const { columns, start } = map;
      // From the Waystation's room, facing east, down the first road each time
      let from = start;
      let rooms = columns[0].map((n) => n.cell);
      let stage = generateStage(new RNG(seed), 1, {
        kind: 'combat',
        ahead: rooms.map(() => 'combat'),
        sides: sidesToward(from, { x: 1, y: 0 }, rooms),
      });
      let row = 0;
      for (let c = 0; c < columns.length - 1; c++) {
        const node = columns[c][row];
        const next = node.next.map((r) => columns[c + 1][r].cell);
        const area = generateStage(new RNG(seed + c), 2, {
          kind: 'combat',
          ahead: next.map(() => 'combat'),
          sides: sidesToward(node.cell, { x: node.cell.x - from.x, y: node.cell.y - from.y }, next),
        });
        placeBeyond(area, stage.exits[rooms.indexOf(rooms.find((r) => r === node.cell)!)]);
        const a = rectOf(stage);
        const b = rectOf(area);
        const step = {
          x: Math.sign(Math.round((b.x0 + b.x1 - a.x0 - a.x1) / 2)),
          y: Math.sign(Math.round((b.z0 + b.z1 - a.z0 - a.z1) / 2)),
        };
        const want = { x: node.cell.x - from.x, y: node.cell.y - from.y };
        // The area lies past the one before, the way the plan steps.
        expect(want.x === 0 ? true : step.x === want.x).toBe(true);
        expect(want.y === 0 ? true : step.y === want.y).toBe(true);
        from = node.cell;
        rooms = next;
        stage = area;
        row = node.next[0];
      }
    }
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

describe('rewards on the map', () => {
  it('are on every fight, and no two roads from one fork pay the same', () => {
    for (const seed of SEEDS) {
      const { columns } = generateLayerMap(new RNG(seed), 2, true);
      for (const column of columns) {
        for (const node of column) {
          expect(node.reward !== undefined).toBe(node.objective !== undefined);
        }
      }
      const forks = [
        columns[0],
        ...columns
          .slice(0, -1)
          .flatMap((column, c) => column.map((n) => n.next.map((row) => columns[c + 1][row]))),
      ];
      for (const fork of forks) {
        const paid = fork.map((n) => n.reward).filter((r) => r !== undefined);
        expect(new Set(paid).size).toBe(paid.length);
      }
    }
  });

  it('are the same for a seed', () => {
    const rewards = (seed: number): unknown =>
      generateLayerMap(new RNG(seed), 2).columns.map((c) => c.map((n) => n.reward));
    expect(rewards(5)).toEqual(rewards(5));
  });
});

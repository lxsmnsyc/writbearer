import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { placeBeyond } from '../../src/gen/place';
import { type ExitSide, type Stage, generateStage, rectOf } from '../../src/gen/stage';
import { inRect } from '../../src/sim/nav';

const build = (seed: number, sides: ExitSide[], objective?: 'maze'): Stage =>
  generateStage(new RNG(seed), 3, {
    kind: 'combat',
    ahead: sides.map(() => 'combat'),
    sides,
    objective,
  });

describe('joining areas', () => {
  it('puts each exit on the edge it was asked for', () => {
    const stage = build(1, ['north', 'east', 'south']);
    const [north, east, south] = stage.exits;
    expect(north.z).toBeLessThan(4);
    expect(east.x).toBeGreaterThan(stage.width - 4);
    expect(south.z).toBeGreaterThan(stage.depth - 4);
    expect([north.out, east.out, south.out]).toEqual([
      { x: 0, z: -1 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ]);
  });

  for (const side of ['north', 'east', 'south'] as const) {
    it(`lays the next area beyond a ${side} exit, edge to edge`, () => {
      const here = build(2, [side]);
      const way = here.exits[0];
      const next = placeBeyond(build(3, ['east'], 'maze'), way);
      const a = rectOf(here);
      const b = rectOf(next);
      // They meet along one edge and do not overlap.
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      expect(Math.min(overlapX, overlapZ)).toBeCloseTo(0);
      expect(Math.max(overlapX, overlapZ)).toBeGreaterThan(4);
      // The entrance is just across from the exit, the way it leads.
      const dx = next.entrance.x - way.x;
      const dz = next.entrance.z - way.z;
      expect(dx * way.out.x + dz * way.out.z).toBeGreaterThan(3);
      expect(Math.abs(dx * way.out.z - dz * way.out.x)).toBeLessThan(1);
      // Everything in it moved with it, and its exits lead on the same way.
      for (const p of [...next.props, ...next.packs, ...(next.hazards ?? [])]) {
        expect(inRect(b, p)).toBe(true);
      }
      expect(next.exits[0].out).toEqual(way.out);
      expect(next.goal && inRect(b, { x: next.goal.x0 + 0.1, z: next.goal.z0 + 0.1 })).toBe(true);
    });
  }
});

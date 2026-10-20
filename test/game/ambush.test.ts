import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import ObjectiveRun from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { type MapNode, generateLayerMap, seenAs } from '../../src/gen/graph';
import { generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind, Side } from '../../src/sim/types';
import { updateWarnings } from '../../src/sim/warning';

const DT = 0.05;

describe('an Ambush', () => {
  it('is laid only where a Camp could be, never on a road from or to a Camp, and with no mutators', () => {
    const found = Array.from({ length: 60 }, (_, k) => k + 1).flatMap((seed) => {
      const { columns } = generateLayerMap(new RNG(seed), 2, false, seed % 4);
      return columns.flatMap((column, c) =>
        column.flatMap((node, j) => (node.objective === 'ambush' ? [{ columns, c, j, node }] : [])),
      );
    });
    for (const { columns, c, j, node } of found) {
      expect(c).toBeGreaterThanOrEqual(3);
      expect(node.kind).toBe('combat');
      expect(node.mutators ?? []).toHaveLength(0);
      const before = columns[c - 1].filter((n) => n.next.includes(j));
      const after = node.next.map((r) => columns[c + 1][r]);
      expect([...before, ...after].some((n: MapNode) => n.kind === 'camp')).toBe(false);
    }
    expect(found.length).toBeGreaterThan(0);
  });

  it('shows as a Camp, with nothing of the fight', () => {
    const node: MapNode = {
      row: 0,
      kind: 'combat',
      next: [],
      cell: { x: 3, y: 0 },
      objective: 'ambush',
      reward: 'gold',
      challenge: 'untouched',
    };
    const seen = seenAs(node);
    expect(seen.kind).toBe('camp');
    expect(seen.objective).toBeUndefined();
    expect(seen.reward).toBeUndefined();
    expect(seen.challenge).toBeUndefined();
    const hunt: MapNode = { ...node, objective: 'hunt' };
    expect(seenAs(hunt)).toBe(hunt);
  });

  it('lies in wait round a fire, and springs once the bearer comes near it', () => {
    const s = generateStage(new RNG(6), 12, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'ambush',
    });
    expect(s.props.some((p) => p.kind === 'campfire')).toBe(true);
    expect(s.packs).toHaveLength(0);
    const waves = s.waves ?? [];
    expect(waves.length).toBe(3);
    const fire = s.rest!;
    for (const w of waves) {
      expect(Math.hypot(w.from.x - fire.x, w.from.z - fire.z)).toBeGreaterThan(4);
    }
    const sim = new Sim(1);
    enterStage(sim, s);
    const bearer = spawnParty(sim, s, []);
    const run = new ObjectiveRun('ambush', s);
    const step = (seconds: number): void => {
      for (let t = 0; t < seconds; t += DT) {
        run.update(sim, DT, 14);
        updateWarnings(sim, DT);
      }
    };
    step(2);
    expect(run.hidden()).toBe(true);
    expect(sim.living(Side.Monster)).toHaveLength(0);
    bearer.x = fire.x - 3;
    bearer.z = fire.z;
    step(2);
    expect(run.hidden()).toBe(false);
    const all = waves.reduce((n, w) => n + w.kinds.length, 0);
    expect(sim.living(Side.Monster)).toHaveLength(all);
    expect(run.done).toBe(false);
    for (const m of sim.living(Side.Monster)) {
      m.hit(m, {
        kind: DamageKind.True,
        fixed: m.derived.maxHp * 2,
        flags: DamageFlags.Redirected,
      });
    }
    step(DT);
    expect(run.done).toBe(true);
  });
});

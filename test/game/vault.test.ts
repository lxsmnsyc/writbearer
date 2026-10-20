import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import ObjectiveRun from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { type Stage, generateStage, monsterLevel, navFor } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';

const DT = 0.05;

const vault = (seed: number, index = 3): Stage =>
  generateStage(new RNG(seed), index, { kind: 'combat', ahead: ['combat'], objective: 'vault' });

describe('a Vault', () => {
  it('is rolled on every layer', () => {
    for (const depth of [0, 1, 2, 3]) {
      const rolled = Array.from({ length: 30 }, (_, seed) =>
        generateLayerMap(new RNG(seed + 1), 2, false, depth),
      )
        .flatMap((m) => m.columns.flat())
        .some((n) => n.objective === 'vault');
      expect(rolled, `layer ${depth}`).toBe(true);
    }
  });

  it('stands ringed by traps, its door reachable, its key on the lair’s leader', () => {
    for (let seed = 1; seed <= 16; seed++) {
      for (const index of [2, 10, 18, 26]) {
        const s = vault(seed, index);
        const v = s.vault!;
        expect(s.props.filter((p) => p.kind === 'vault')).toHaveLength(1);
        expect(s.packs[1].key).toBe(0);
        expect(s.reward).toEqual(v.door);
        const traps = s.hazards ?? [];
        expect(traps.length).toBeGreaterThanOrEqual(6);
        for (const h of traps) {
          expect(Math.hypot(h.x - v.x, h.z - v.z)).toBeLessThan(4);
        }
        const end = navFor(s).path(s.entrance, v.door).at(-1)!;
        expect(Math.hypot(end.x - v.door.x, end.z - v.door.z), `${seed} ${index}`).toBeLessThan(1);
      }
    }
  });

  it('gives the key to a monster as the area is entered', () => {
    const s = vault(5);
    const sim = new Sim(1);
    enterStage(sim, s);
    expect(sim.living(Side.Monster).filter((m) => m.bearsKey)).toHaveLength(1);
  });

  it('opens once the bearer brings the key to its door, and not before', () => {
    const s = vault(7);
    const sim = new Sim(1);
    enterStage(sim, s);
    const bearer = spawnParty(sim, s, []);
    const run = new ObjectiveRun('vault', s);
    const v = s.vault!;
    bearer.x = v.door.x;
    bearer.z = v.door.z;
    expect(run.update(sim, DT, monsterLevel(3))).toBe(false);
    expect(run.status(sim)).toContain('holds the vault’s key');
    v.key = true;
    bearer.x = v.door.x - 3;
    expect(run.update(sim, DT, monsterLevel(3))).toBe(false);
    expect(run.status(sim)).toContain('Bring the key');
    bearer.x = v.door.x;
    expect(run.update(sim, DT, monsterLevel(3))).toBe(true);
    expect(v.open).toBe(true);
    expect(s.props.find((p) => p.kind === 'vault')?.open).toBe(true);
  });
});

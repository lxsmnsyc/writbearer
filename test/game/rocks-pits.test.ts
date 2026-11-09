import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import dropRocks from '../../src/game/rocks';
import { enterStage, spawnParty } from '../../src/game/stage';
import { type Stage, generateStage, navFor } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';

const DT = 0.05;

// An open field that holds a trap field, searching seeds
function fieldWithTraps(skip = 0): Stage {
  let found = 0;
  for (let seed = 1; seed < 400; seed++) {
    const s = generateStage(new RNG(seed), 3, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'hunt',
    });
    if (s.hazards?.some((h) => h.kind === 'plate') && found++ >= skip) {
      return s;
    }
  }
  throw new Error('no trap field rolled');
}

describe('a trap field', () => {
  it('is rolled in open fields, and keeps off the entrance, exits and roads', () => {
    for (let skip = 0; skip < 6; skip++) {
      const s = fieldWithTraps(skip);
      const plates = (s.hazards ?? []).filter((h) => h.kind === 'plate');
      const pits = s.props.filter((p) => p.kind === 'pit');
      expect(plates.length).toBeGreaterThan(0);
      expect(pits.length).toBeGreaterThan(0);
      for (const t of [...plates, ...pits]) {
        expect(Math.hypot(t.x - s.entrance.x, t.z - s.entrance.z)).toBeGreaterThan(5);
        for (const e of s.exits) {
          expect(Math.hypot(t.x - e.x, t.z - e.z)).toBeGreaterThan(3.5);
        }
        for (const road of s.roads) {
          for (const r of road) {
            expect(Math.hypot(t.x - r.x, t.z - r.z)).toBeGreaterThan(2);
          }
        }
      }
    }
  });

  it('has pits that block bodies, seen by navFor, with a way round to every exit', () => {
    const s = fieldWithTraps();
    const nav = navFor(s);
    for (const p of s.props.filter((q) => q.kind === 'pit')) {
      expect(nav.walkable(p.x, p.z)).toBe(false);
    }
    for (const e of s.exits) {
      const end = nav.path(s.entrance, e).at(-1)!;
      expect(Math.hypot(end.x - e.x, end.z - e.z)).toBeLessThan(2);
    }
  });

  it('is not laid in a Vault', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = generateStage(new RNG(seed), 3, {
        kind: 'combat',
        ahead: ['combat'],
        objective: 'vault',
      });
      expect(s.hazards?.some((h) => h.kind === 'plate')).toBe(false);
    }
  });
});

describe('a rock plate', () => {
  it('warns, strikes everyone in the circle and no one outside it, then leaves rubble', () => {
    const s = fieldWithTraps();
    const sim = new Sim(1);
    enterStage(sim, s);
    const bearer = spawnParty(sim, s, []);
    const g = { stage: s, sim };
    const plate = s.hazards!.find((h) => h.kind === 'plate')!;
    const monster = sim.living(Side.Monster)[0];
    // The bearer stands on the plate, a monster in the circle, one outside it
    bearer.x = plate.x;
    bearer.z = plate.z;
    monster.x = plate.x + 1.5;
    monster.z = plate.z;
    const far = sim.living(Side.Monster)[1];
    far.x = plate.x + 6;
    far.z = plate.z;
    const hp = [bearer.hp, monster.hp, far.hp];
    const props = s.props.length;
    dropRocks(g);
    expect(plate.spent).toBe(true);
    // Nothing is struck while it warns
    sim.tick(DT);
    expect([bearer.hp, monster.hp, far.hp]).toEqual(hp);
    expect(s.props).toHaveLength(props);
    for (let i = 0; i < 40; i++) {
      sim.tick(DT);
    }
    expect(bearer.hp).toBeLessThan(hp[0]);
    expect(monster.hp).toBeLessThan(hp[1]);
    expect(far.hp).toBe(hp[2]);
    // The rubble blocks, the plate is gone
    const rubble = s.props.at(-1)!;
    expect(rubble.kind).toBe('rubble');
    expect(sim.obstacles.some((o) => o.x === plate.x && o.z === plate.z)).toBe(true);
    expect(s.hazards).not.toContain(plate);
    // A way round remains to every exit
    const nav = navFor(s);
    for (const e of s.exits) {
      const end = nav.path(s.entrance, e).at(-1)!;
      expect(Math.hypot(end.x - e.x, end.z - e.z)).toBeLessThan(2);
    }
  });

  it('drops its rock once, and also for a monster that steps on it', () => {
    const s = fieldWithTraps();
    const sim = new Sim(1);
    enterStage(sim, s);
    spawnParty(sim, s, []);
    const g = { stage: s, sim };
    const plate = s.hazards!.find((h) => h.kind === 'plate')!;
    const monster = sim.living(Side.Monster)[0];
    monster.x = plate.x;
    monster.z = plate.z;
    dropRocks(g);
    expect(plate.spent).toBe(true);
    const warnings = sim.warnings.length;
    dropRocks(g);
    expect(sim.warnings).toHaveLength(warnings);
  });
});

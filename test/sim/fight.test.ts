import { describe, expect, it } from 'vitest';
import { type MonsterKind, spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { Priority, Stance, type Toggles } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

interface Fight {
  sim: Sim;
  bearer: Unit;
  mercs: Unit[];
  monsters: Unit[];
}

type Placement = [MonsterKind, number, number];

// A mixed pack ahead, past the monsters' sight.
const PACK: Placement[] = [
  ['hollowSoldier', 14, 1],
  ['penitent', 14.5, -1],
  ['penitent', 15, 0],
  ['crawler', 13.5, 2],
];

// Crawlers in front to lure the mercs away, and a Penitent coming from
// behind for the bearer.
const AMBUSH: Placement[] = [
  ['crawler', 6, 0.6],
  ['crawler', 6.2, -0.6],
  ['penitent', -8, 0.5],
];

// The bearer and two mercs at the origin, facing the pack.
function fight(
  seed: number,
  pack: Placement[],
  options: { mercs?: boolean; toggles?: Toggles } = {},
): Fight {
  const sim = new Sim(seed);
  const bearer = spawnBearer(sim, 0, 0);
  const mercs =
    options.mercs === false
      ? []
      : [
          spawnMerc(sim, 'vanguard', 5, 0.8, 0.6, options.toggles),
          spawnMerc(sim, 'ranger', 5, -0.6, -0.6, options.toggles),
        ];
  const monsters = pack.map(([kind, x, z]) => spawnMonster(sim, kind, 4, x, z));
  return { sim, bearer, mercs, monsters };
}

const settled = (f: Fight) => (): boolean =>
  !f.bearer.alive || f.sim.living(Side.Monster).length === 0;

describe('a fight with no rendering', () => {
  it('ends with the pack dead and the bearer alive when mercs guard it', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const f = fight(seed, PACK);
      f.bearer.order = { x: 10, z: 0 };
      f.sim.run(90, settled(f));
      expect(f.bearer.alive).toBe(true);
      expect(f.sim.living(Side.Monster)).toHaveLength(0);
    }
  });

  it('kills the bearer when nobody guards it, so the pack is a real threat', () => {
    const f = fight(1, PACK, { mercs: false });
    f.bearer.order = { x: 10, z: 0 };
    f.sim.run(90, settled(f));
    expect(f.bearer.alive).toBe(false);
  });

  it('wakes the pack only once the party comes near', () => {
    const f = fight(1, PACK);
    f.sim.run(2);
    expect(f.monsters.every((m) => !m.aware)).toBe(true);
    f.bearer.order = { x: 10, z: 0 };
    f.sim.run(4);
    expect(f.monsters.every((m) => m.aware)).toBe(true);
  });

  it('plays out the same way for the same seed', () => {
    const replay = (): string => {
      const f = fight(42, PACK);
      f.bearer.order = { x: 10, z: 0 };
      f.sim.run(90, settled(f));
      return [...f.sim.units]
        .map((u) => `${u.name}:${u.hp}:${u.x.toFixed(3)},${u.z.toFixed(3)}`)
        .join(' ');
    };
    expect(replay()).toBe(replay());
  });

  it('keeps the bearer safer in an ambush when mercs put "attacking the bearer" first', () => {
    const damageTaken = (priorities: Priority[]): number => {
      let total = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const f = fight(seed, AMBUSH, {
          toggles: { stance: Stance.Guard, priorities, chase: 9, skills: {}, drinkAt: 0.3 },
        });
        // An ambush is sprung, not noticed: every monster starts awake.
        for (const m of f.monsters) {
          m.aware = true;
        }
        f.sim.run(90, settled(f));
        total += f.bearer.derived.maxHp - Math.max(0, f.bearer.hp);
      }
      return total;
    };
    const guarded = damageTaken([Priority.AttackingBearer, Priority.Nearest]);
    const careless = damageTaken([Priority.Nearest]);
    expect(careless).toBeGreaterThan(0);
    expect(guarded).toBeLessThan(careless);
  });

  it('lets the bearer walk, with guard mercs following', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0.8, 0.4);
    bearer.order = { x: 10, z: 0 };
    sim.run(8);
    expect(bearer.x).toBeCloseTo(10, 1);
    expect(vanguard.distanceTo(bearer)).toBeLessThan(2);
  });
});

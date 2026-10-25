import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import Director, { PEAK, scoreArea } from '../../src/game/director';
import { THREAT, generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

function field(): { sim: Sim; director: Director; bearer: Unit; merc: Unit } {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 60 }]);
  const bearer = spawnBearer(sim, 10, 10);
  const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
  return { sim, director: new Director(sim, new RNG(3)), bearer, merc };
}

const hurt = (u: Unit, share: number): void => {
  u.hit(u, {
    kind: DamageKind.True,
    fixed: Math.round(u.derived.maxHp * share),
    flags: DamageFlags.Redirected,
  });
};

const run = (director: Director, seconds: number): void => {
  for (let t = 0; t < seconds; t += DT) {
    director.update(DT);
  }
};

describe('the level director', () => {
  it('raises a member’s intensity as it is hurt, by how much, and lets it decay when left alone', () => {
    const { director, merc } = field();
    hurt(merc, 0.1);
    const small = director.intensityOf(merc);
    hurt(merc, 0.3);
    expect(small).toBeGreaterThan(0);
    expect(director.intensityOf(merc) - small).toBeGreaterThan(small * 2);
    const high = director.intensityOf(merc);
    run(director, 4);
    expect(director.intensityOf(merc)).toBeLessThan(high);
  });

  it('keeps intensity up while a monster is engaging the member', () => {
    const { sim, director, merc } = field();
    hurt(merc, 0.3);
    const m = spawnMonster(sim, 'husk', 5, 30, 30);
    m.aware = true;
    m.target = merc;
    const high = director.intensityOf(merc);
    run(director, 4);
    expect(director.intensityOf(merc)).toBe(high);
  });

  it('raises everyone’s when a merc falls, and those near a monster as it dies', () => {
    const { sim, director, bearer, merc } = field();
    const other = spawnMerc(sim, 'ranger', 5, 40, 40);
    hurt(other, 2);
    expect(director.intensityOf(bearer)).toBeGreaterThan(0.3);
    const before = director.intensityOf(merc);
    const m = spawnMonster(sim, 'husk', 5, 13, 10);
    hurt(m, 2);
    expect(director.intensityOf(merc)).toBeGreaterThan(before);
  });

  it('counts the bearer’s intensity double when pacing', () => {
    const { director, bearer, merc } = field();
    hurt(merc, 0.2);
    const merc1 = director.pacing();
    hurt(bearer, 0.1);
    expect(director.intensityOf(bearer)).toBeLessThan(director.intensityOf(merc));
    expect(director.pacing()).toBeGreaterThan(merc1);
  });

  it('builds up, sustains the peak, lets it fade, relaxes, and builds up again', () => {
    const { sim, director, merc } = field();
    expect(director.phase).toBe('buildUp');
    hurt(merc, PEAK / 1.2 + 0.05);
    const m = spawnMonster(sim, 'husk', 5, 30, 30);
    m.aware = true;
    m.target = merc;
    run(director, DT);
    expect(director.phase).toBe('sustainPeak');
    run(director, 5.1);
    expect(director.phase).toBe('peakFade');
    // The fight plays out: nothing engaging, so intensity decays out of the peak.
    m.target = null;
    run(director, 4);
    expect(director.phase).toBe('relax');
    expect(director.phaseLeft()).toBeGreaterThan(25);
    run(director, 46);
    expect(director.phase).toBe('buildUp');
  });

  it('ends a relax early once the bearer has moved on far enough', () => {
    const { sim, director, bearer, merc } = field();
    hurt(merc, 0.75);
    const m = spawnMonster(sim, 'husk', 5, 50, 50);
    m.aware = true;
    m.target = merc;
    run(director, 5.2);
    m.target = null;
    run(director, 4);
    expect(director.phase).toBe('relax');
    bearer.x += 30;
    run(director, DT);
    expect(director.phase).toBe('buildUp');
  });

  it('scores an area from how it went, and moves the run’s standing by it', () => {
    const good = { health: 1, potions: 8, usual: 180, bonus: true, levelAhead: 3 };
    const bad = { health: 0.2, potions: 0, usual: 180, bonus: false, levelAhead: -3 };
    expect(scoreArea(good, 0, 60).score).toBeGreaterThan(0.5);
    expect(scoreArea(bad, 2, 300).score).toBeLessThan(-0.5);
    const noTime = scoreArea({ ...good, usual: Infinity, bonus: null }, 0, 60);
    expect(noTime.pace).toBeNull();
    expect(noTime.bonus).toBeNull();
    const { director } = field();
    director.beginArea();
    director.endArea(good);
    const up = director.standing;
    expect(up).toBeGreaterThan(0);
    for (let i = 0; i < 6; i++) {
      director.beginArea();
      director.endArea(bad);
    }
    expect(director.standing).toBeLessThan(0);
    expect(director.standing).toBeGreaterThanOrEqual(-1);
  });
});

describe('difficulty from standing', () => {
  it('scales a fight within a quarter either way, and never eases an Elite', () => {
    const { director } = field();
    director.standing = -1;
    expect(director.scale(false)).toBeCloseTo(0.75);
    expect(director.scale(true)).toBe(1);
    director.standing = 1;
    expect(director.scale(false)).toBeCloseTo(1.25);
    expect(director.scale(true)).toBeCloseTo(1.25);
    director.standing = 0;
    expect(director.scale(false)).toBe(1);
  });

  it('puts more threat in a fight for a party winning easily, and less for one struggling', () => {
    const threat = (scale: number, objective: 'hunt' | 'horde'): number => {
      let sum = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const s = generateStage(new RNG(seed), 10, {
          kind: 'combat',
          ahead: ['combat'],
          objective,
          scale,
        });
        const kinds = [
          ...s.packs.flatMap((p) => p.kinds),
          ...(s.waves ?? []).flatMap((w) => w.kinds),
        ];
        sum += kinds.reduce((n, k) => n + THREAT[k], 0);
      }
      return sum;
    };
    for (const objective of ['hunt', 'horde'] as const) {
      expect(threat(1.25, objective)).toBeGreaterThan(threat(1, objective));
      expect(threat(0.75, objective)).toBeLessThan(threat(1, objective));
    }
  });
});

describe('relief after a hard stretch', () => {
  // Runs a director through a peak to its relax, and asks for relief.
  function afterPeak(
    standing: number,
    seed: number,
  ): { relief: ReturnType<Director['takeRelief']>; director: Director; sim: Sim } {
    const sim = new Sim(1);
    sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 60 }]);
    const bearer = spawnBearer(sim, 10, 10);
    const director = new Director(sim, new RNG(seed));
    director.standing = standing;
    director.beginArea(
      [
        { kind: 'relief', x: 22, z: 10 },
        { kind: 'relief', x: 10, z: 24 },
        { kind: 'relief', x: 50, z: 50 },
      ],
      null,
    );
    hurt(bearer, 0.5);
    for (let t = 0; t < 30 && director.phase !== 'relax'; t += DT) {
      director.update(DT);
    }
    return { relief: director.takeRelief(), director, sim };
  }

  it('comes only once a peak has faded, out of sight and near the bearer', () => {
    const { director } = field();
    director.beginArea([{ kind: 'relief', x: 25, z: 10 }], null);
    expect(director.takeRelief()).toBeNull();
    for (let seed = 1; seed <= 20; seed++) {
      const { relief, director: d } = afterPeak(-1, seed);
      expect(relief).not.toBeNull();
      expect(relief!.x === 50).toBe(false);
      // Asked again in the same relax, nothing more
      expect(d.takeRelief()).toBeNull();
    }
  });

  it('comes less often for a party doing well', () => {
    const count = (standing: number): number =>
      Array.from({ length: 40 }, (_, i) => afterPeak(standing, i + 1).relief).filter(Boolean)
        .length;
    expect(count(-1)).toBeGreaterThan(count(1));
    expect(count(1)).toBeGreaterThan(0);
  });
});

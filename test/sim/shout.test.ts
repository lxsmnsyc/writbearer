import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { SHOUTS, Shout, cooldownLeft, cry, responseDelay } from '../../src/sim/shout';
import Sim from '../../src/sim/sim';
import { DamageKind } from '../../src/sim/types';

describe('shouts', () => {
  it('go on cooldown, and say when they are ready again', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    spawnMerc(sim, 'vanguard', 5, 1, 0);
    expect(cry(sim, Shout.Hold)).toBeNull();
    expect(cooldownLeft(sim, Shout.Hold)).toBe(SHOUTS[Shout.Hold].cooldown);
    expect(cry(sim, Shout.Hold)).toMatch(/ready in 10 seconds/);
    expect(cry(sim, Shout.Rally)).toBeNull();
    sim.run(SHOUTS[Shout.Hold].cooldown);
    expect(cry(sim, Shout.Hold)).toBeNull();
  });

  it('are acted on sooner by a disciplined merc', () => {
    const sim = new Sim(1);
    const keen = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const slack = spawnMerc(sim, 'vanguard', 5, 0, 1);
    keen.discipline = 90;
    slack.discipline = 10;
    expect(responseDelay(keen)).toBeLessThan(responseDelay(slack));
    expect(responseDelay(slack)).toBeCloseTo(0.2 + (100 - 9) * 0.01);
  });

  it('Hold: the merc stays where it stands instead of chasing', () => {
    const run = (hold: boolean): number => {
      const sim = new Sim(1);
      spawnBearer(sim, 0, 0);
      const merc = spawnMerc(sim, 'vanguard', 5, 1, 0);
      merc.discipline = 100;
      const husk = spawnMonster(sim, 'husk', 4, 5, 0);
      husk.aware = true;
      husk.kit.moveSpeed = 0;
      if (hold) {
        cry(sim, Shout.Hold);
      }
      sim.run(1.5);
      return merc.x;
    };
    expect(run(false)).toBeGreaterThan(2);
    // It may take a step while the shout reaches it, no more.
    expect(run(true)).toBeLessThan(2);
  });

  it('Fall back: the merc breaks off and runs behind the bearer', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 5, 2, 0);
    merc.discipline = 100;
    const husk = spawnMonster(sim, 'husk', 4, 3, 0);
    husk.aware = true;
    husk.kit.moveSpeed = 0;
    sim.run(0.5);
    expect(merc.target).toBe(husk);
    cry(sim, Shout.FallBack);
    sim.run(2);
    expect(merc.target).toBeNull();
    expect(merc.x).toBeLessThan(bearer.x);
  });

  it('Rally: a chasing merc comes back to the bearer', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 5, 4, 0);
    merc.discipline = 100;
    const husk = spawnMonster(sim, 'husk', 4, 5.5, 0);
    husk.aware = true;
    husk.kit.moveSpeed = 0;
    cry(sim, Shout.Rally);
    sim.run(3);
    expect(merc.distanceTo(bearer)).toBeLessThan(2);
  });

  it('Focus: every merc goes for the marked enemy, until it dies', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'ranger', 5, 1, 0);
    merc.discipline = 100;
    const near = spawnMonster(sim, 'husk', 4, 3, 0);
    const far = spawnMonster(sim, 'husk', 4, 5, 1);
    for (const m of [near, far]) {
      m.aware = true;
      m.kit.moveSpeed = 0;
    }
    expect(cry(sim, Shout.Focus)).toMatch(/Point at an enemy/);
    sim.run(0.5);
    expect(merc.target).toBe(near);
    expect(cry(sim, Shout.Focus, far)).toBeNull();
    sim.run(2);
    expect(merc.target).toBe(far);
    merc.hit(far, { kind: DamageKind.True, fixed: 99999 });
    sim.run(1.5);
    expect(merc.heard).toBeNull();
    expect(merc.target).toBe(near);
  });
});

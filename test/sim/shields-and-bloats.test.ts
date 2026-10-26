import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { generateStage } from '../../src/gen/stage';
import { DEFAULT_TOGGLES, copyToggles } from '../../src/sim/ai';
import Sim, { strike } from '../../src/sim/sim';
import { POISON } from '../../src/sim/statuses';
import { DamageFlags, DamageKind } from '../../src/sim/types';

const DT = 0.05;

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

// The kinds of monster in the packs of an area, over a few seeds
function kinds(index: number): Set<string> {
  const all = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) {
    const s = generateStage(new RNG(seed), index, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'hunt',
    });
    for (const p of s.packs) {
      for (const k of p.kinds) {
        all.add(k);
      }
    }
  }
  return all;
}

describe('the Hollow Shieldbearer', () => {
  it('takes little of a blow from the front, and all of one from behind', () => {
    const sim = field();
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const shield = spawnMonster(sim, 'hollowShieldbearer', 5, 11, 10);
    const blow = (): number => {
      const before = shield.hp;
      strike(merc, shield, { fixed: 100, flags: DamageFlags.Sure });
      const taken = before - shield.hp;
      shield.hp = shield.derived.maxHp;
      return taken;
    };
    shield.angle = Math.PI;
    const front = blow();
    shield.angle = 0;
    const back = blow();
    expect(front).toBeLessThan(back * 0.3);
  });

  it('does not block magic', () => {
    const sim = field();
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const shield = spawnMonster(sim, 'hollowShieldbearer', 5, 11, 10);
    const blow = (): number => {
      const before = shield.hp;
      strike(merc, shield, { fixed: 100, kind: DamageKind.Magical });
      const taken = before - shield.hp;
      shield.hp = shield.derived.maxHp;
      return taken;
    };
    shield.angle = Math.PI;
    const front = blow();
    shield.angle = 0;
    expect(front).toBe(blow());
  });

  it('turns slowly toward whoever is behind it', () => {
    const sim = field();
    spawnBearer(sim, 35, 35);
    const merc = spawnMerc(sim, 'vanguard', 5, 18, 20);
    merc.toggles = { ...copyToggles(DEFAULT_TOGGLES), chase: 0 };
    const shield = spawnMonster(sim, 'hollowShieldbearer', 5, 19, 20);
    shield.aware = true;
    shield.angle = 0;
    sim.tick(0.1);
    expect(Math.abs(shield.angle)).toBeLessThanOrEqual(shield.kit.turn * 0.1 * 2 + 1e-9);
    expect(shield.isFlankedBy(merc)).toBe(true);
  });

  it('stands in the Rift Road’s packs', () => {
    expect(kinds(12).has('hollowShieldbearer')).toBe(true);
  });
});

describe('the Bloat', () => {
  it('bursts once at the party, poisoning and leaving a cloud', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 20, 20);
    const bloat = spawnMonster(sim, 'bloat', 5, 21, 20);
    bloat.aware = true;
    let warned = false;
    for (let t = 0; t < 3; t += DT) {
      sim.tick(DT);
      warned ||= sim.warnings.some((w) => w.source === bloat);
    }
    expect(warned).toBe(true);
    expect(bloat.alive).toBe(false);
    expect(bloat.torn).toBe(true);
    expect(bearer.hp).toBeLessThan(bearer.derived.maxHp);
    expect(sim.zones.some((z) => z.kind === 'venomCloud')).toBe(true);
    expect(bearer.statuses.has(POISON.id)).toBe(true);
  });

  it('only pops if killed before it bursts', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 20, 20);
    const bloat = spawnMonster(sim, 'bloat', 5, 21, 20);
    bloat.aware = true;
    for (let t = 0; t < 1 && !sim.warnings.some((w) => w.source === bloat); t += DT) {
      sim.tick(DT);
    }
    expect(sim.warnings.some((w) => w.source === bloat)).toBe(true);
    bloat.hp = 0;
    bloat.die(null);
    for (let t = 0; t < 2; t += DT) {
      sim.tick(DT);
    }
    expect(bearer.hp).toBe(bearer.derived.maxHp);
    expect(sim.zones.some((z) => z.kind === 'venomCloud')).toBe(false);
  });

  it('stands in the Marches’ packs from the third area', () => {
    expect(kinds(4).has('bloat')).toBe(true);
  });
});

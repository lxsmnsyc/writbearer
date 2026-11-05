import { describe, expect, it } from 'vitest';
import { BESTIARY } from '../../src/content/bestiary';
import { CARD_BY_MONSTER } from '../../src/content/cards';
import { type MonsterKind, spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { MONSTER_ORDER } from '../../src/game/compendium';
import { FACTIONS, packOf } from '../../src/gen/stage/packs';
import RNG from '../../src/core/rng';
import { isKind } from '../../src/render/rig';
import { isSkulker } from '../../src/sim/ai/skulker';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { canTarget } from '../../src/sim/targeting';
import { DREAD } from '../../src/sim/statuses';
import { DamageKind } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;
const DREAD_KINDS = ['drownedBell', 'whisperer', 'skulker'] as const;

function world(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
  return sim;
}

// A monster that stands where it is, awake
function post(sim: Sim, kind: MonsterKind, x: number, z: number): Unit {
  const m = spawnMonster(sim, kind, 4, x, z);
  m.aware = true;
  m.still = true;
  return m;
}

// Runs a while with the merc held in place; whether Dread took hold of it
function frightened(sim: Sim, merc: Unit, seconds: number): boolean {
  const { x, z } = merc;
  let taken = false;
  for (let t = 0; t < seconds; t += DT) {
    sim.tick(DT);
    merc.x = x;
    merc.z = z;
    merc.hp = merc.derived.maxHp;
    taken ||= merc.statuses.has(DREAD.id);
  }
  return taken;
}

describe('the Drowned Bell', () => {
  it('frightens a merc within 6 tiles while a husk stands beside it', () => {
    const sim = world();
    spawnBearer(sim, 55, 35);
    const merc = spawnMerc(sim, 'vanguard', 5, 25, 10);
    const bell = post(sim, 'drownedBell', 20, 10);
    post(sim, 'husk', 22, 10);
    expect(bell.speed).toBe(0);
    expect(frightened(sim, merc, 12)).toBe(true);
  });

  it('builds none with no monster near it, or out of its reach', () => {
    const alone = world();
    spawnBearer(alone, 55, 35);
    const merc = spawnMerc(alone, 'vanguard', 5, 25, 10);
    post(alone, 'drownedBell', 20, 10);
    post(alone, 'husk', 30, 20);
    expect(frightened(alone, merc, 12)).toBe(false);

    const far = world();
    spawnBearer(far, 55, 35);
    const distant = spawnMerc(far, 'vanguard', 5, 29, 10);
    post(far, 'drownedBell', 20, 10);
    post(far, 'husk', 22, 10);
    expect(frightened(far, distant, 12)).toBe(false);
  });

  it('stops when it is broken', () => {
    const sim = world();
    spawnBearer(sim, 55, 35);
    const merc = spawnMerc(sim, 'vanguard', 5, 25, 10);
    const bell = post(sim, 'drownedBell', 20, 10);
    post(sim, 'husk', 22, 10);
    bell.hp = 0;
    bell.lastBlow = { value: 1, flags: 0 };
    bell.die(null);
    expect(frightened(sim, merc, 12)).toBe(false);
  });
});

describe('the Whisperer', () => {
  it('frightens a merc at 3 tiles and not at 5', () => {
    const near = world();
    spawnBearer(near, 55, 35);
    const merc = spawnMerc(near, 'vanguard', 5, 23, 10);
    post(near, 'whisperer', 20, 10);
    expect(frightened(near, merc, 12)).toBe(true);

    const far = world();
    spawnBearer(far, 55, 35);
    const distant = spawnMerc(far, 'vanguard', 5, 25, 10);
    post(far, 'whisperer', 20, 10);
    expect(frightened(far, distant, 12)).toBe(false);
  });

  it('never frightens the bearer, and not a Brave merc', () => {
    const sim = world();
    const bearer = spawnBearer(sim, 23, 10);
    const brave = spawnMerc(sim, 'vanguard', 5, 18, 10, undefined, { traits: ['brave'] });
    post(sim, 'whisperer', 20, 10);
    expect(frightened(sim, brave, 12)).toBe(false);
    expect(bearer.statuses.has(DREAD.id)).toBe(false);
  });
});

describe('the Skulker', () => {
  it('is hidden at spawn and no merc may pick it', () => {
    const sim = world();
    spawnBearer(sim, 50, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const skulker = spawnMonster(sim, 'skulker', 4, 14, 10);
    expect(isSkulker(skulker)).toBe(true);
    expect(skulker.hidden).toBe(true);
    expect(canTarget(merc, skulker)).toBe(false);
  });

  it('shows itself at 2 tiles from the bearer, hits it, and hides again', () => {
    const sim = world();
    const bearer = spawnBearer(sim, 30, 20);
    const skulker = spawnMonster(sim, 'skulker', 4, 22, 20);
    skulker.aware = true;
    let at = -1;
    sim.on(SimEvents.UnitRevealed, 0, (event) => {
      if (event.source === skulker && at < 0) {
        at = skulker.distanceTo(bearer);
      }
    });
    const hp = bearer.hp;
    let hit = false;
    for (let t = 0; t < 20 && !hit; t += DT) {
      sim.tick(DT);
      hit = bearer.hp < hp;
    }
    expect(hit).toBe(true);
    expect(at).toBeGreaterThan(1.5);
    expect(at).toBeLessThanOrEqual(2.1);
    expect(skulker.hidden).toBe(false);
    for (let t = 0; t < 2; t += DT) {
      sim.tick(DT);
    }
    expect(skulker.hidden).toBe(true);
  });

  it('is revealed by area damage', () => {
    const sim = world();
    spawnBearer(sim, 50, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const skulker = spawnMonster(sim, 'skulker', 4, 40, 10);
    merc.hit(skulker, { kind: DamageKind.True, fixed: 1 });
    expect(skulker.hidden).toBe(false);
    expect(canTarget(merc, skulker)).toBe(true);
  });

  it('does not stall a fight: two Skulkers against a party die within 120 s', () => {
    const sim = world();
    spawnBearer(sim, 30, 20);
    spawnMerc(sim, 'vanguard', 5, 31, 20);
    spawnMerc(sim, 'ranger', 5, 29, 21);
    spawnMerc(sim, 'cleric', 5, 29, 19);
    const skulkers = [
      spawnMonster(sim, 'skulker', 4, 15, 15),
      spawnMonster(sim, 'skulker', 4, 15, 25),
    ];
    for (const s of skulkers) {
      s.aware = true;
    }
    let t = 0;
    while (t < 120 && skulkers.some((s) => s.alive)) {
      sim.tick(DT);
      t += DT;
    }
    expect(skulkers.every((s) => !s.alive)).toBe(true);
  });
});

describe('the dread monsters', () => {
  it.each(DREAD_KINDS)(
    '%s spawns and has a card, a bestiary entry, a slot and a figure',
    (kind) => {
      const sim = world();
      const unit = spawnMonster(sim, kind, 4, 10, 10);
      expect(unit.kind).toBe(kind);
      expect(CARD_BY_MONSTER[kind]).toBeDefined();
      expect(BESTIARY[kind].who.length).toBeGreaterThan(0);
      expect(MONSTER_ORDER).toContain(kind);
      expect(isKind(kind)).toBe(true);
      expect(FACTIONS.some((f) => f.kinds.includes(kind))).toBe(true);
    },
  );

  it('puts at most one Bell in a pack', () => {
    const faction = FACTIONS.find((f) => f.kinds.includes('drownedBell'));
    expect(faction?.layer).toBe(2);
    const rng = new RNG(5);
    for (let i = 0; i < 50; i++) {
      const pack = packOf(rng, faction!);
      expect(pack.filter((k) => k === 'drownedBell')).toHaveLength(1);
    }
  });
});

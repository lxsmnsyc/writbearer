import { describe, expect, it } from 'vitest';
import { BESTIARY } from '../../src/content/bestiary';
import { CARD_BY_MONSTER } from '../../src/content/cards';
import { BASES } from '../../src/content/items';
import { MONSTERS, spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { MONSTER_ORDER } from '../../src/game/compendium';
import { FACTIONS } from '../../src/gen/stage/packs';
import { plainItem } from '../../src/gen/loot';
import { isKind } from '../../src/render/rig';
import { Hunt } from '../../src/sim/ai';
import { rage } from '../../src/sim/berserk';
import { isRaiser } from '../../src/sim/ai/raiser';
import { SimEvents } from '../../src/sim/events';
import { EquipSlot } from '../../src/sim/item';
import { raisedBy } from '../../src/sim/raise';
import Sim from '../../src/sim/sim';
import { isStripped } from '../../src/sim/strip';
import { BLEED } from '../../src/sim/statuses';
import { type Pocket, steal } from '../../src/sim/theft';
import { DamageFlags, DamageKind, DamagePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;
const KEEPERS = ['ossuaryPriest', 'titheTaker', 'confessor', 'flagellant'] as const;

function world(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
  return sim;
}

// A basic attack landing
function strike(from: Unit, to: Unit, fixed = 10): void {
  from.hit(to, { kind: DamageKind.True, fixed, flags: DamageFlags.BasicAttack });
}

function fall(u: Unit): Unit {
  u.hp = 0;
  u.lastBlow = { value: 1, flags: 0 };
  u.die(null);
  return u;
}

describe('the Ossuary Priest', () => {
  it('raises a fallen penitent as a husk and keeps behind its allies', () => {
    const sim = world();
    spawnBearer(sim, 50, 30);
    const priest = spawnMonster(sim, 'ossuaryPriest', 4, 10, 10);
    priest.aware = true;
    expect(isRaiser(priest)).toBe(true);
    expect(priest.hunt).toBe(Hunt.Support);
    const body = fall(spawnMonster(sim, 'penitent', 4, 12, 10));
    for (let t = 0; t < 10; t += DT) {
      sim.tick(DT);
    }
    const brood = raisedBy(priest);
    expect(brood).toHaveLength(1);
    expect(brood[0].kind).toBe('husk');
    expect(sim.units.has(body)).toBe(false);
  });
});

describe('the Tithe-Taker', () => {
  function pocketed(sim: Sim): { taken: () => number } {
    let n = 0;
    const pocket: Pocket = {
      pick: () => ({ gold: 5 }),
      take: () => {
        n++;
      },
      give: () => {},
    };
    sim.pocket = pocket;
    return { taken: () => n };
  }

  it('takes one item an area across all Tithe-Takers', () => {
    const sim = world();
    spawnBearer(sim, 10, 10);
    const { taken } = pocketed(sim);
    const a = spawnMonster(sim, 'titheTaker', 4, 12, 10);
    const b = spawnMonster(sim, 'titheTaker', 4, 14, 10);
    expect(steal(a, sim)).toBe(true);
    expect(steal(b, sim)).toBe(false);
    expect(taken()).toBe(1);
    // The next area: another may take one
    sim.area++;
    const c = spawnMonster(sim, 'titheTaker', 4, 16, 10);
    expect(steal(c, sim)).toBe(true);
    expect(taken()).toBe(2);
  });
});

describe('the Confessor', () => {
  it('strips a weapon with a landed hit', () => {
    const sim = world();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const base = BASES.find((b) => b.id === 'armingSword');
    if (!base) {
      throw new Error('armingSword');
    }
    merc.equip(EquipSlot.Weapon, plainItem(base));
    const confessor = spawnMonster(sim, 'confessor', 4, 13, 10);
    strike(confessor, merc);
    expect(isStripped(merc, EquipSlot.Weapon)).toBe(true);
  });
});

describe('the Flagellant', () => {
  // The damage of one blow at the given share of health, as dealt
  function blow(share: number): { value: number; merc: Unit } {
    const sim = world();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const f = spawnMonster(sim, 'flagellant', 4, 13, 10);
    f.hp = Math.round(f.derived.maxHp * share);
    let value = 0;
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (e) => {
      if (e.source === f) {
        value = e.value;
      }
    });
    strike(f, merc, 20);
    return { value, merc };
  }

  it('hits harder when hurt and leaves Bleed', () => {
    const full = blow(1);
    const hurt = blow(0.2);
    expect(hurt.value).toBeGreaterThan(full.value);
    expect(hurt.merc.statuses.has(BLEED.id)).toBe(true);
  });

  it('has no rage at full health', () => {
    const sim = world();
    const f = spawnMonster(sim, 'flagellant', 4, 13, 10);
    expect(rage(f)).toBe(0);
  });
});

describe('the keepers in the game', () => {
  it('spawn, with a card, a bestiary entry, a compendium slot and a figure', () => {
    for (const kind of KEEPERS) {
      const sim = world();
      expect(spawnMonster(sim, kind, 3, 10, 10).kind).toBe(kind);
      expect(MONSTERS[kind]).toBeDefined();
      expect(CARD_BY_MONSTER[kind]).toBeDefined();
      expect(BESTIARY[kind].who.length).toBeGreaterThan(0);
      expect(MONSTER_ORDER).toContain(kind);
      expect(isKind(kind)).toBe(true);
    }
  });

  it('are fielded by a layer 2 pack', () => {
    for (const kind of KEEPERS) {
      const packs = FACTIONS.filter((f) => f.layer === 2 && f.kinds.includes(kind));
      expect(packs.length).toBeGreaterThan(0);
    }
  });
});

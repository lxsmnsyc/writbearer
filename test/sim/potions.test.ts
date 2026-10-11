import { describe, expect, it } from 'vitest';
import { BASE_BY_ID } from '../../src/content/items';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { findNode, learn } from '../../src/content/trees';
import { BELT_STACK, Pack, beltToPack, packToBelt } from '../../src/game/inventory';
import { potionStack } from '../../src/gen/loot';
import { DEFAULT_TOGGLES, DRINK_AT, setToggles } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';

const HEAL = BASE_BY_ID.get('healingDraught')!;
const MANA = BASE_BY_ID.get('manaTincture')!;

describe('drinking', () => {
  it('restores health over a few seconds, one potion at a time', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    bearer.hp = 10;
    const stack = potionStack(HEAL, 2);
    expect(bearer.drink(stack)).toBe(true);
    expect(bearer.drink(stack)).toBe(false);
    expect(stack.quantity).toBe(1);
    sim.run(3.1);
    expect(bearer.hp).toBe(10 + Math.floor((bearer.derived.maxHp * 0.35) / 6) * 6);
  });

  it('a merc drinks from its belt below its threshold, and not above it', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const potions = vanguard.belt[0]!.quantity;
    vanguard.hp = vanguard.derived.maxHp * 0.4;
    sim.tick();
    expect(vanguard.belt[0]!.quantity).toBe(potions);
    vanguard.hp = vanguard.derived.maxHp * 0.25;
    sim.tick();
    expect(vanguard.belt[0]!.quantity).toBe(potions - 1);
  });

  it('holds out until an emergency when told to', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    setToggles(vanguard, { ...DEFAULT_TOGGLES, drinkAt: DRINK_AT.emergency });
    const potions = vanguard.belt[0]!.quantity;
    vanguard.hp = vanguard.derived.maxHp * 0.25;
    sim.tick();
    expect(vanguard.belt[0]!.quantity).toBe(potions);
    vanguard.hp = vanguard.derived.maxHp * 0.1;
    sim.tick();
    expect(vanguard.belt[0]!.quantity).toBe(potions - 1);
  });

  it('drinks for mana only in a fight, and only with skills to spend it on', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    ranger.belt[0] = null;
    ranger.belt[1] = potionStack(MANA, 1);
    ranger.mana = 0;
    // No skills yet: mana is no use to it.
    const crawler = spawnMonster(sim, 'crawler', 4, 3, 0);
    crawler.aware = true;
    sim.run(0.5);
    expect(ranger.belt[1]).not.toBeNull();
    const aimed = findNode(ranger, 'aimedShot')!;
    learn(ranger, aimed.branch, aimed.node);
    ranger.mana = 0;
    sim.run(0.5);
    expect(ranger.belt[1]).toBeNull();
  });
});

describe('the belt', () => {
  it('fills from pack stacks, five to a slot, and empties back into the pack', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 5, 1, 0);
    ranger.belt.fill(null);
    const pack = new Pack();
    pack.add(potionStack(HEAL, 8));
    expect(pack.items).toHaveLength(1);
    expect(pack.weight).toBe(16);
    const uid = pack.items[0].uid;
    expect(packToBelt(sim, bearer, pack, ranger, uid)).toBeNull();
    expect(ranger.belt[0]!.quantity).toBe(BELT_STACK);
    expect(pack.items[0].quantity).toBe(3);
    expect(packToBelt(sim, bearer, pack, ranger, uid)).toBeNull();
    expect(ranger.belt[1]!.quantity).toBe(3);
    expect(pack.items).toHaveLength(0);
    expect(beltToPack(sim, bearer, pack, ranger, 0)).toBeNull();
    expect(pack.items[0].quantity).toBe(BELT_STACK);
  });

  it('stacks potions in the pack up to the stack size', () => {
    const pack = new Pack();
    pack.add(potionStack(HEAL, 7));
    pack.add(potionStack(HEAL, 6));
    expect(pack.items.map((i) => i.quantity)).toEqual([10, 3]);
  });

  it('in a fight, is restocked only from next to the merc', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 5, 6, 0);
    spawnMonster(sim, 'crawler', 4, 3, 3).aware = true;
    const pack = new Pack();
    pack.add(potionStack(HEAL, 2));
    expect(packToBelt(sim, bearer, pack, ranger, pack.items[0].uid)).toMatch(/stand next to/);
  });
});

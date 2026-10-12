import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { PIECE_BY_ID, SET_BY_ID, applySets, setCount } from '../../src/content/sets';
import RNG from '../../src/core/rng';
import { loadItem, saveItem } from '../../src/game/save';
import { itemLines, makeSetPiece, rollSetPiece } from '../../src/gen/loot';
import { EquipSlot, type Item, Quality, slotFor } from '../../src/sim/item';
import { effectiveDiscipline } from '../../src/sim/morale';
import Sim from '../../src/sim/sim';
import { Category, bonusKey } from '../../src/sim/stats';
import { DamageKind, Rank } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const piece = (id: string): Item => makeSetPiece(PIECE_BY_ID.get(id)!.piece);
const wear = (unit: Unit, item: Item, slot = slotFor(item)!): void => {
  unit.equip(slot, item);
};
const IRON = SET_BY_ID.get('ironCompany')!;

function party(): { sim: Sim; bearer: Unit; mercs: Unit[] } {
  const sim = new Sim(1);
  const bearer = spawnBearer(sim, 0, 0);
  const mercs = [
    spawnMerc(sim, 'vanguard', 6, 1, 0),
    spawnMerc(sim, 'vanguard', 6, 2, 0),
    spawnMerc(sim, 'cleric', 6, 3, 0),
    spawnMerc(sim, 'ranger', 6, 4, 0),
  ];
  return { sim, bearer, mercs };
}

// Kills a merc without tearing its body apart.
function kill(sim: Sim, merc: Unit): void {
  merc.hp = 1;
  spawnMonster(sim, 'mite', 1, merc.x, merc.z).hit(merc, { kind: DamageKind.True, fixed: 1 });
}

describe('squad sets', () => {
  it('count pieces across the party, one for each merc that wears any', () => {
    const { sim, mercs } = party();
    wear(mercs[0], piece('ironHelm'));
    wear(mercs[0], piece('ironHauberk'));
    expect(setCount(sim, IRON)).toBe(1);
    wear(mercs[1], piece('ironBanner'), EquipSlot.Offhand);
    expect(setCount(sim, IRON)).toBe(2);
    kill(sim, mercs[1]);
    expect(setCount(sim, IRON)).toBe(1);
  });

  it('give every living merc the bonuses, and the bearer its own', () => {
    const { sim, bearer, mercs } = party();
    const armor = mercs.map((m) => m.derived.armor);
    wear(mercs[0], piece('ironHelm'));
    wear(mercs[1], piece('ironHauberk'));
    applySets(sim);
    // Two pieces: +10% armor for every merc, the wearers on their own pieces too
    expect(mercs[3].derived.armor).toBeCloseTo(armor[3] * 1.1, 0);
    expect(mercs[2].disciplineBonus).toBe(0);

    wear(mercs[2], piece('ironSignet'), EquipSlot.Accessory1);
    applySets(sim);
    expect(mercs[3].disciplineBonus).toBe(10);
    expect(mercs[2].disciplineBonus).toBe(15);
    expect(effectiveDiscipline(mercs[3])).toBeGreaterThan(mercs[3].discipline * 0.9);
    const key = bonusKey(Category.Kind, DamageKind.Physical);
    expect(bearer.stats.reduce.get(key) ?? 0).toBe(0);

    wear(mercs[3], piece('ironBanner'), EquipSlot.Offhand);
    applySets(sim);
    expect(bearer.stats.reduce.get(key)).toBe(15);

    // A wearer's death takes the full set's bonus away.
    kill(sim, mercs[3]);
    applySets(sim);
    expect(bearer.stats.reduce.get(key) ?? 0).toBe(0);
    expect(mercs[0].disciplineBonus).toBe(10);
  });

  it('the Pale Choir raises the first merc to die, once an area', () => {
    const { sim, mercs } = party();
    wear(mercs[0], piece('choirCenser'), EquipSlot.Weapon);
    wear(mercs[1], piece('choirHood'));
    wear(mercs[2], piece('choirVestments'));
    applySets(sim);
    // The wearer dies, and its death breaks the set; it rises all the same.
    kill(sim, mercs[2]);
    applySets(sim);
    expect(mercs[2].alive).toBe(false);
    sim.tick(0.05);
    expect(mercs[2].alive).toBe(true);
    expect(mercs[2].hp).toBe(Math.floor(mercs[2].derived.maxHp * 0.3));
    applySets(sim);
    kill(sim, mercs[3]);
    sim.tick(0.05);
    expect(mercs[3].alive).toBe(false);
    sim.area++;
    kill(sim, mercs[2]);
    sim.tick(0.05);
    expect(mercs[2].alive).toBe(true);
  });

  it('the Warden’s Watch makes the bearer harder to hit', () => {
    const { sim, bearer, mercs } = party();
    const evasion = bearer.derived.evasion;
    wear(mercs[0], piece('wardenBow'), EquipSlot.Weapon);
    wear(mercs[1], piece('wardenCloak'));
    wear(mercs[2], piece('wardenBoots'));
    applySets(sim);
    expect(bearer.derived.evasion).toBe(evasion + 25);
  });

  it('drop rarely, as named green items with their set in the tooltip', () => {
    const rng = new RNG(4);
    let normal = 0;
    let boss = 0;
    for (let i = 0; i < 5000; i++) {
      normal += rollSetPiece(rng, 10, Rank.Normal) ? 1 : 0;
      boss += rollSetPiece(rng, 10, Rank.Boss) ? 1 : 0;
    }
    expect(normal).toBeLessThan(60);
    expect(boss).toBeGreaterThan(800);
    expect(rollSetPiece(new RNG(1), 1, Rank.Boss)).toBeNull();
    const helm = piece('ironHelm');
    expect(helm.quality).toBe(Quality.Set);
    expect(helm.sockets).toBe(0);
    const lines = itemLines(helm);
    expect(lines).toContain('+20 armor');
    expect(lines).toContain('  4: The bearer takes 15% less damage');
    expect(loadItem(structuredClone(saveItem(helm)))?.piece).toBe('ironHelm');
  });
});

import { describe, expect, it } from 'vitest';
import { wageFor, wageOf } from '../../src/content/recruits';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import { RunStreams, Stream } from '../../src/core/seed';
import { Pack, Vault, storeInVault, takeFromVault } from '../../src/game/inventory';
import { spawnParty } from '../../src/game/stage';
import { Payroll, desert } from '../../src/game/wages';
import {
  MORALE_START,
  Morale,
  PAID,
  UNPAID,
  UNPAID_DISCIPLINE,
  moraleOf,
  shiftMorale,
} from '../../src/sim/morale';
import { plainItem } from '../../src/gen/loot';
import { generateWaystation, navFor } from '../../src/gen/stage';
import { BASE_BY_ID } from '../../src/content/items';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';

const station = (): ReturnType<typeof generateWaystation> =>
  generateWaystation(new RunStreams('ASHEN').area(1, Stream.Layout, 1008), 8);

describe('wages', () => {
  it('grow with the level, and Greedy asks half again', () => {
    expect(wageOf({ level: 10, traits: [] })).toBe(wageFor(10));
    expect(wageOf({ level: 10, traits: ['greedy'] })).toBe(Math.round(wageFor(10) * 1.5));
    expect(wageOf({ level: 12, traits: [] })).toBeGreaterThan(wageOf({ level: 10, traits: [] }));
  });

  it('are asked by living mercs only, paid once, and the unpaid lose heart', () => {
    const sim = new Sim(1);
    const stage = station();
    spawnParty(sim, stage, []);
    const odo = spawnMerc(sim, 'vanguard', 10, 3, 9, undefined, { name: 'Odo' });
    const maren = spawnMerc(sim, 'ranger', 10, 3, 11, undefined, { name: 'Maren' });
    const dead = spawnMerc(sim, 'cleric', 10, 4, 10, undefined, { name: 'Hask' });
    spawnMonster(sim, 'mite', 1, 20, 20).hit(dead, { kind: DamageKind.True, fixed: 99999 });
    // Hask's death cost the others heart; start them level.
    odo.morale = MORALE_START;
    maren.morale = MORALE_START;
    const payroll = new Payroll();
    expect(payroll.dues(sim).map((d) => d.merc)).toEqual([odo, maren]);

    const pack = new Pack();
    pack.gold = wageOf(odo) + 10;
    const before = { odo: odo.morale, maren: maren.morale, discipline: maren.discipline };
    expect(payroll.pay(pack, odo)).toBeNull();
    expect(pack.gold).toBe(10);
    expect(odo.morale).toBe(before.odo + PAID);
    expect(payroll.pay(pack, odo)).toMatch(/is paid/);
    expect(payroll.pay(pack, maren)).toMatch(/wants/);

    expect(payroll.settle(sim)).toEqual([maren]);
    expect(maren.morale).toBe(before.maren + UNPAID);
    expect(maren.discipline).toBe(before.discipline + UNPAID_DISCIPLINE);
    expect(moraleOf(maren)).toBe(Morale.Low);
    // Low, not broken: it stays, sullen.
    expect(desert(sim)).toEqual([]);
    // A second unpaid wage breaks it, and it deserts.
    shiftMorale(maren, UNPAID);
    expect(desert(sim)).toEqual([maren]);
    const party = [...sim.units].filter((u) => u.side === Side.Party);
    expect(party).toContain(odo);
    expect(party).toContain(dead);
    expect(party).not.toContain(maren);
  });
});

describe('the vault', () => {
  it('takes items from the pack and gives them back', () => {
    const pack = new Pack();
    const vault = new Vault();
    const sword = plainItem(BASE_BY_ID.get('armingSword')!);
    pack.add(sword);
    expect(storeInVault(pack, vault, sword.uid)).toBeNull();
    expect(pack.items).toHaveLength(0);
    expect(vault.items).toEqual([sword]);
    expect(takeFromVault(pack, vault, sword.uid)).toBeNull();
    expect(pack.items).toEqual([sword]);
    expect(vault.items).toHaveLength(0);
  });

  it('keeps an item that does not fit in the pack', () => {
    const pack = new Pack();
    const vault = new Vault();
    const mail = plainItem(BASE_BY_ID.get('hauberk')!);
    vault.items.push(mail);
    while (pack.add(plainItem(BASE_BY_ID.get('hauberk')!))) {
      // Fill the pack to its weight limit.
    }
    expect(takeFromVault(pack, vault, mail.uid)).toMatch(/heavy|full/);
    expect(vault.items).toEqual([mail]);
  });
});

describe('the Waystation', () => {
  it('is safe, has the post, and the road on is open', () => {
    const stage = station();
    expect(stage.packs).toHaveLength(0);
    expect(stage.boss).toBeUndefined();
    expect(stage.station).toBeDefined();
    expect(stage.props.some((p) => p.kind === 'post')).toBe(true);
    const nav = navFor(stage);
    for (const goal of [stage.station!, stage.exit]) {
      const end = nav.path(stage.entrance, goal).at(-1)!;
      expect(Math.hypot(end.x - goal.x, end.z - goal.z)).toBeLessThan(1);
    }
  });
});

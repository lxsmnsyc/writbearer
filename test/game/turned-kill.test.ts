import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { RunStreams } from '../../src/core/seed';
import watchSim from '../../src/game/game/listeners';
import type GameState from '../../src/game/game/state';
import { Pack } from '../../src/game/inventory';
import { turn } from '../../src/sim/control';
import type { Item } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

// Only what the kill listener reads of a run: the counts, the pack and the drops.
function run(sim: Sim, bearer: Unit): { g: GameState; dropped: Item[][] } {
  const dropped: Item[][] = [];
  const g = {
    sim,
    bearer,
    slain: 0,
    stageIndex: 0,
    streams: new RunStreams('TURNED'),
    pack: new Pack(),
    compendium: { beat: () => undefined },
    effects: { levelUp: () => undefined },
    hooks: {},
    bonus: null,
    souls: 0,
    over: false,
    mercs: () => [...sim.units].filter((u) => u.side === Side.Party && u !== bearer),
    scatter: (items: Item[]) => {
      dropped.push(items);
    },
    say: () => undefined,
  } as unknown as GameState; // oxlint-disable-line typescript/no-unsafe-type-assertion
  watchSim(g);
  return { g, dropped };
}

describe('a turned monster that dies', () => {
  it('pays no kill, xp or drops, unlike a plain monster', () => {
    const sim = new Sim(1);
    sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
    const bearer = spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 10, 11, 10);
    const turned = spawnMonster(sim, 'mite', 1, 12, 10);
    const plain = spawnMonster(sim, 'mite', 1, 14, 10);
    const { g, dropped } = run(sim, bearer);
    turn(sim, turned, 5, bearer);
    const xp = merc.xp;
    plain.hit(turned, { kind: DamageKind.True, fixed: 99999 });
    expect(turned.alive).toBe(false);
    expect(g.slain).toBe(0);
    expect(merc.xp).toBe(xp);
    expect(dropped).toEqual([]);
    // Control: a plain monster's death is paid
    bearer.hit(plain, { kind: DamageKind.True, fixed: 99999 });
    expect(g.slain).toBe(1);
    expect(dropped.length).toBe(1);
  });
});

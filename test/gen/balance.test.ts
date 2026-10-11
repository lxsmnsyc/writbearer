import { describe, expect, it } from 'vitest';
import { EventPriority } from '../../src/core/event-emitter';
import { RunStreams, Stream } from '../../src/core/seed';
import { BASE_BY_ID, STARTER_PACK } from '../../src/content/items';
import type { Offer } from '../../src/content/recruits';
import { spawnMerc } from '../../src/content/roster';
import { findNode, learn } from '../../src/content/trees';
import { Pack } from '../../src/game/inventory';
import { START_LEVEL, carryParty, enterStage, spawnParty } from '../../src/game/stage';
import { potionStack } from '../../src/gen/loot';
import { type Stage, generateStage } from '../../src/gen/stage';
import { SimEvents } from '../../src/sim/events';
import { gainXp, killXp } from '../../src/sim/progress';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

// How a player might spend each job's first points, in order.
const PLAN: Record<Offer['kind'], string[]> = {
  vanguard: ['challenge', 'sunder', 'crush', 'vow', 'challenge', 'crush', 'vow', 'sunder'],
  ranger: ['aimedShot', 'snare', 'chargedArrow', 'pinDown', 'aimedShot', 'snare', 'pinDown'],
  cleric: ['heal', 'smite', 'renew', 'heal', 'smite', 'renew', 'heal'],
};

function spend(merc: Unit, job: Offer['kind']): void {
  for (const id of PLAN[job]) {
    const found = findNode(merc, id);
    if (found) {
      learn(merc, found.branch, found.node);
    }
  }
}

// The bearer walks to the stair, steps behind its merc while monsters near
// it are awake, and drinks when hurt. Returns whether it reached the stair.
function cross(sim: Sim, bearer: Unit, merc: Unit, pack: Pack, stage: Stage): boolean {
  for (let t = 0; t < 240 && bearer.alive; t += 0.05) {
    if (bearer.distanceTo(stage.exit) <= 1.2) {
      return true;
    }
    const threats = sim.living(Side.Monster).filter((m) => m.aware && m.distanceTo(bearer) < 7);
    const threat = threats.sort((a, b) => a.distanceTo(bearer) - b.distanceTo(bearer)).at(0);
    if (threat && merc.alive) {
      // Step behind the merc, away from the nearest threat.
      const dx = merc.x - threat.x;
      const dz = merc.z - threat.z;
      const d = Math.hypot(dx, dz) || 1;
      bearer.order = { x: merc.x + (dx / d) * 1.5, z: merc.z + (dz / d) * 1.5 };
    } else {
      bearer.order = { ...stage.exit };
    }
    const potion = bearer.hp < bearer.derived.maxHp * 0.4 ? pack.healingPotion() : undefined;
    if (potion && bearer.drink(potion)) {
      pack.tidy();
    }
    sim.tick();
  }
  return false;
}

// How many of the first `stages` stages a lone merc gets the bearer through, per seed.
function run(job: Offer['kind'], seed: string, stages: number): number {
  const streams = new RunStreams(seed);
  const sim = new Sim(streams.get(1, Stream.Combat));
  let stage = generateStage(streams.area(1, Stream.Layout, 0), 0);
  const bearer = spawnParty(sim, stage, []);
  const merc = spawnMerc(sim, job, START_LEVEL, stage.entrance.x + 1, stage.entrance.z);
  spend(merc, job);
  const pack = new Pack();
  for (const [id, n] of STARTER_PACK) {
    pack.add(potionStack(BASE_BY_ID.get(id)!, n));
  }
  sim.on(SimEvents.UnitDies, EventPriority.Post, (e) => {
    if (e.source.side === Side.Monster && merc.alive && gainXp(merc, killXp(e.source)) > 0) {
      spend(merc, job);
    }
  });
  enterStage(sim, stage);
  for (let i = 0; i < stages; i++) {
    if (!cross(sim, bearer, merc, pack, stage)) {
      return i;
    }
    stage = generateStage(streams.area(1, Stream.Layout, i + 1), i + 1);
    carryParty(sim, stage);
    enterStage(sim, stage);
  }
  return stages;
}

describe('balance', () => {
  it('lets a lone merc of any job see the bearer through the first two stages', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => `B${i}`);
    for (const job of ['vanguard', 'ranger', 'cleric'] as const) {
      const cleared = seeds.filter((seed) => run(job, seed, 2) === 2).length;
      expect(cleared, job).toBeGreaterThanOrEqual(11);
    }
  }, 60000);
});

import { describe, expect, it } from 'vitest';
import { CLEAVE, LITANY, LUNGE, SANCTIFIED, spawnBoss } from '../../src/content/bosses';
import type { Offer } from '../../src/content/recruits';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { learn, treeFor } from '../../src/content/trees';
import { RunStreams, Stream } from '../../src/core/seed';
import { enterStage, spawnParty } from '../../src/game/stage';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import { generateStage } from '../../src/gen/stage';
import { DEFAULT_TOGGLES, Priority } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';
import { DREAD } from '../../src/sim/statuses';
import { SimEvents } from '../../src/sim/events';
import { DamageKind, Side, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const LEVEL = [9, 18, 26, 34];

// Spends every point down the first nodes it can learn, as a player might.
function spendAll(m: Unit): void {
  for (let pass = 0; pass < 40 && m.skillPoints > 0; pass++) {
    for (const branch of treeFor(m)) {
      for (const node of branch.nodes) {
        if (m.skillPoints > 0) {
          learn(m, branch, node);
        }
      }
    }
  }
}

// A party four levels below a layer's boss, the bearer keeping about five
// tiles from it. Returns whether the boss died first.
function fight(seed: number, layer: number, jobs: Offer['kind'][]): boolean {
  const sim = new Sim(seed);
  sim.setFloor(40, 30);
  const bearer = spawnBearer(sim, 6, 15);
  const toggles = { ...DEFAULT_TOGGLES, priorities: [Priority.AttackingBearer, Priority.Elites] };
  jobs.forEach((job, i) => {
    spendAll(spawnMerc(sim, job, LEVEL[layer] - 4, 8, 13 + i * 1.5, toggles));
  });
  const boss = spawnBoss(sim, layer, LEVEL[layer], 16, 15);
  boss.aware = true;
  for (let t = 0; t < 240 && boss.alive && bearer.alive; t += 0.05) {
    const d = bearer.distanceTo(boss);
    bearer.order =
      d > 5.5
        ? { x: boss.x - ((boss.x - bearer.x) / d) * 5, z: boss.z - ((boss.z - bearer.z) / d) * 5 }
        : null;
    sim.tick();
  }
  return !boss.alive && bearer.alive;
}

const SEEDS = [1, 2, 3, 4, 5, 6];

describe('each layer', () => {
  it('has its own boss in its last area', () => {
    const kinds = [0, 1, 2, 3].map((layer) => {
      const index = layer * AREAS_PER_LAYER + AREAS_PER_LAYER - 1;
      const stage = generateStage(new RunStreams('ASHEN').area(1, Stream.Layout, index), index);
      const sim = new Sim(1);
      spawnParty(sim, stage, []);
      return enterStage(sim, stage)?.kind;
    });
    expect(kinds).toEqual(['broodMother', 'gatekeeper', 'abbess', 'hollowedSaint']);
  });

  it('boss is beaten by three mercs four levels below it, and not by two', () => {
    for (const layer of [1, 2, 3]) {
      const three = SEEDS.filter((s) => fight(s, layer, ['vanguard', 'ranger', 'cleric'])).length;
      const two = SEEDS.filter((s) => fight(s, layer, ['vanguard', 'ranger'])).length;
      expect(three, `layer ${layer}`).toBeGreaterThanOrEqual(5);
      expect(two, `layer ${layer}`).toBeLessThanOrEqual(2);
    }
  });
});

describe('the Gatekeeper', () => {
  it('cleaves everything in front of him, and nothing behind', () => {
    const sim = new Sim(1);
    const boss = spawnBoss(sim, 1, 18, 10, 10);
    boss.angle = 0;
    // Rangers carry no shield to block with, and every blow lands.
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      event.hit = true;
    });
    const front = spawnMerc(sim, 'ranger', 10, 11.5, 10.5);
    const side = spawnMerc(sim, 'ranger', 10, 11.5, 9.4);
    const behind = spawnMerc(sim, 'ranger', 10, 8.5, 10);
    const hp = [front, side, behind].map((u) => u.hp);
    expect(boss.startCast(CLEAVE, front)).toBe(true);
    sim.run(CLEAVE.windup + 0.05);
    expect(front.hp).toBeLessThan(hp[0]);
    expect(side.hp).toBeLessThan(hp[1]);
    expect(behind.hp).toBe(hp[2]);
  });

  it('calls three of his guard at half health', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const boss = spawnBoss(sim, 1, 18, 10, 10);
    bearer.hit(boss, { kind: DamageKind.True, fixed: boss.derived.maxHp * 0.6 });
    const guard = sim.living(Side.Monster).filter((m) => m.kind === 'hollowSoldier');
    expect(guard).toHaveLength(3);
    expect(guard.every((g) => g.aware)).toBe(true);
  });
});

describe('the Abbess', () => {
  it('sanctifies her Penitents, who take no harm, but not herself', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const boss = spawnBoss(sim, 2, 26, 10, 10);
    const penitents = sim.living(Side.Monster).filter((m) => m.kind === 'penitent');
    expect(penitents).toHaveLength(2);
    boss.aware = true;
    expect(boss.startCast(LITANY, null)).toBe(true);
    sim.run(LITANY.windup + 0.05);
    expect(penitents.every((p) => p.statuses.has(SANCTIFIED.id))).toBe(true);
    expect(boss.statuses.has(SANCTIFIED.id)).toBe(false);
    const hp = penitents[0].hp;
    bearer.hit(penitents[0], { kind: DamageKind.True, fixed: 50 });
    expect(penitents[0].hp).toBe(hp);
  });

  it('wastes the Litany if broken off', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const boss = spawnBoss(sim, 2, 26, 10, 10);
    boss.aware = true;
    boss.startCast(LITANY, null);
    sim.run(1);
    boss.cast = null;
    sim.run(LITANY.windup);
    expect(sim.living(Side.Monster).some((m) => m.statuses.has(SANCTIFIED.id))).toBe(false);
  });
});

describe('the Hollowed Saint', () => {
  it('builds up Dread in mercs near her', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const boss = spawnBoss(sim, 3, 34, 10, 10);
    boss.aware = true;
    // She stays put: no walking, and no lunging off to the bearer.
    boss.kit.moveSpeed = 0;
    boss.skills.length = 0;
    const near = spawnMerc(sim, 'vanguard', 20, 11.5, 10);
    const far = spawnMerc(sim, 'vanguard', 20, 16, 10);
    sim.run(1.05);
    const dread = (u: Unit): boolean =>
      u.statuses.has(DREAD.id) || (u.buildup.get(DREAD.id) ?? 0) > 0;
    expect(dread(near)).toBe(true);
    expect(dread(far)).toBe(false);
  });

  it('lunges to the bearer, past whoever stands between', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const boss = spawnBoss(sim, 3, 34, 8, 0);
    spawnMonster(sim, 'mite', 1, 30, 30);
    boss.aware = true;
    expect(boss.startCast(LUNGE, null)).toBe(true);
    sim.run(LUNGE.windup + 0.05);
    expect(boss.distanceTo(bearer)).toBeLessThan(1.5);
  });
});

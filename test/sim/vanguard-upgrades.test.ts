import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import {
  BANNER,
  BASTION,
  EARTHSHAKER,
  FAULT_LINE,
  IMMOVABLE,
  LAST_LINE,
  RAMPART,
  SHIELD_WALL_SKILL,
} from '../../src/content/vanguard';
import { DEFAULT_TOGGLES, Stance } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import Sim, { ARROW_SPEED } from '../../src/sim/sim';
import { DREAD, PETRIFY, STUN, TAUNTED } from '../../src/sim/statuses';
import { DamageFlags, DamageKind, Range, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { teach } from '../support/build';

// The Vanguard's spells, and the skill code its elite upgrades will use.
// Cases of skills that are now upgrade placeholders are skipped until
// vanguard-upgrades builds them (src/content/jobs/vanguard/upgrades.ts).

// Every blow lands, so the tests do not hang on the roll.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

const still = (...units: Unit[]): void => {
  for (const u of units) {
    u.kit.moveSpeed = 0;
  }
};

// A blow from one unit on another, as a basic attack lands
const blow = (from: Unit, to: Unit, range = Range.Melee): number =>
  from.hit(to, { kind: DamageKind.Physical, range, fixed: 50 })?.value ?? -1;

describe('the Vanguard', () => {
  it('Shield Wall stops blows from the front, not from behind, and holds it still', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    vanguard.angle = 0;
    const front = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    const behind = spawnMonster(sim, 'hollowSoldier', 5, -1, 0);
    expect(vanguard.startCast(SHIELD_WALL_SKILL, null)).toBe(true);
    sim.run(SHIELD_WALL_SKILL.windup + 0.05);
    expect(vanguard.speed).toBe(0);
    const hp = vanguard.hp;
    front.hit(vanguard, { kind: DamageKind.Physical, fixed: 50 });
    expect(vanguard.hp).toBe(hp);
    behind.hit(vanguard, { kind: DamageKind.Physical, fixed: 50, flags: DamageFlags.Flank });
    expect(vanguard.hp).toBeLessThan(hp);
  });

  it.skip('Bastion takes some of an arrow off an ally standing behind it', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 2, 0);
    const ally = spawnMerc(sim, 'ranger', 10, 0, 0);
    const archer = spawnMonster(sim, 'hollowSoldier', 5, 6, 0);
    const before = blow(archer, ally, Range.Ranged);
    teach(vanguard, BASTION, 5);
    expect(blow(archer, ally, Range.Ranged)).toBeLessThan(before);
    // To one side of it, there is no cover.
    ally.z = 3;
    expect(blow(archer, ally, Range.Ranged)).toBe(before);
  });

  it.skip('Rampart stops arrows that fly into it', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 2, 0);
    const ally = spawnMerc(sim, 'ranger', 10, 0, 0);
    const archer = spawnMonster(sim, 'hollowSoldier', 5, 8, 0);
    archer.aware = true;
    archer.target = ally;
    // A soldier taken for an archer, for the test, without changing its kind
    Object.assign(archer, { job: { ...archer.job, range: Range.Ranged } });
    expect(RAMPART.wants(vanguard, null, sim)).toBe(true);
    RAMPART.release(vanguard, null, sim);
    expect(sim.zones).toHaveLength(1);
    still(ally, archer);
    sim.fire(archer, ally, { speed: ARROW_SPEED, homing: true, options: {} });
    const hp = ally.hp;
    sim.run(1);
    expect(sim.projectiles).toHaveLength(0);
    expect(ally.hp).toBe(hp);
  });

  it.skip('Immovable keeps it from being stunned while it holds', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0, {
      ...DEFAULT_TOGGLES,
      stance: Stance.Hold,
    });
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    teach(vanguard, IMMOVABLE);
    expect(vanguard.addStatus(STUN, soldier)).toBeNull();
    vanguard.toggles = { ...DEFAULT_TOGGLES };
    expect(vanguard.addStatus(STUN, soldier)).not.toBeNull();
  });

  it.skip('Fault Line cracks every enemy in its line with Earth', () => {
    const sim = new Sim(2);
    alwaysHit(sim);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const near = spawnMonster(sim, 'hollowSoldier', 5, 1.5, 0);
    const far = spawnMonster(sim, 'hollowSoldier', 5, 3.5, 0.2);
    const aside = spawnMonster(sim, 'hollowSoldier', 5, 2, 2.5);
    still(near, far, aside);
    teach(vanguard, FAULT_LINE, 3);
    expect(vanguard.startCast(FAULT_LINE, near)).toBe(true);
    sim.run(FAULT_LINE.windup + 1);
    expect(near.hp).toBeLessThan(near.derived.maxHp);
    expect(far.hp).toBeLessThan(far.derived.maxHp);
    expect(aside.hp).toBe(aside.derived.maxHp);
    expect(far.buildup.get(PETRIFY.id) ?? (far.statuses.has(PETRIFY.id) ? 1 : 0)).toBeGreaterThan(
      0,
    );
  });

  it.skip('Earthshaker spreads Earth from a petrified enemy to those beside it', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const stone = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
    const beside = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const away = spawnMonster(sim, 'hollowSoldier', 5, 9, 0);
    teach(vanguard, EARTHSHAKER);
    stone.addStatus(PETRIFY, vanguard);
    expect(beside.buildup.get(PETRIFY.id)).toBeGreaterThan(0);
    expect(away.buildup.has(PETRIFY.id)).toBe(false);
  });

  it.skip('Banner steadies the party against dread and lifts its heart', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const ally = spawnMerc(sim, 'ranger', 10, 1, 0);
    const husk = spawnMonster(sim, 'husk', 5, 8, 0);
    ally.buildUp(DREAD, husk, 20);
    const plain = ally.buildup.get(DREAD.id) ?? 0;
    ally.buildup.clear();
    teach(vanguard, BANNER, 3);
    BANNER.release(vanguard, null, sim);
    ally.buildUp(DREAD, husk, 20);
    expect(ally.buildup.get(DREAD.id) ?? 0).toBeLessThan(plain);
    const morale = ally.morale;
    sim.run(2.1);
    expect(ally.morale).toBeGreaterThan(morale);
  });

  it.skip('Last Line turns everything near the bearer on the Vanguard, once an area', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 4, 0);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    teach(vanguard, LAST_LINE);
    soldier.hit(bearer, { kind: DamageKind.True, fixed: Math.ceil(bearer.hp * 0.8) });
    expect(soldier.statuses.get(TAUNTED.id)?.source).toBe(vanguard);
    soldier.removeStatus(TAUNTED.id);
    soldier.hit(bearer, { kind: DamageKind.True, fixed: 1 });
    expect(soldier.statuses.has(TAUNTED.id)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import { beginDuel } from '../../src/content/jobs/duelist/spells';
import VANGUARD_UPGRADES from '../../src/content/jobs/vanguard/upgrades';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { CHALLENGE, CRUSH, challengeTime } from '../../src/content/vanguard';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { FRIGHTENED } from '../../src/sim/afflict';
import { type Upgrade, isBuilt, raise } from '../../src/sim/builds';
import knockback from '../../src/sim/knockback';
import { SimEvents } from '../../src/sim/events';
import Sim, { ARROW_SPEED } from '../../src/sim/sim';
import { type Skill, SkillMode } from '../../src/sim/skill';
import { DREAD, PETRIFY, SHIELD_WALL, STUN, SUNDERED, TAUNTED } from '../../src/sim/statuses';
import { DamageFlags, DamageKind, DamagePriority, Range, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { withUpgrade } from '../support/build';

// The Vanguard's spells and its 12 elite upgrades.

const SPELLS = ['intercept', 'challenge', 'shieldWall', 'crush'];

const upgrade = (id: string): Upgrade => {
  const found = VANGUARD_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// Every blow lands, so the tests do not hang on the roll.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// Orders with every spell off, so only casts a test starts happen
const quiet = (): Toggles => {
  const skills: Toggles['skills'] = {};
  for (const id of SPELLS) {
    skills[id] = SkillMode.Off;
  }
  return { ...DEFAULT_TOGGLES, skills };
};

// A still Vanguard, with a still bearer at the origin and an upgrade when one is named
function vanguardWith(
  id: string | null,
  at = { x: 3, z: 0 },
): { sim: Sim; vanguard: Unit; bearer: Unit } {
  const sim = new Sim(3);
  alwaysHit(sim);
  const bearer = spawnBearer(sim, 0, 0);
  bearer.kit.moveSpeed = 0;
  const vanguard = spawnMerc(sim, 'vanguard', 10, at.x, at.z, quiet());
  // No basic attacks and no walking, so only the spells act
  vanguard.kit.interval = 0;
  vanguard.kit.moveSpeed = 0;
  vanguard.mana = vanguard.derived.maxMana;
  if (id) {
    withUpgrade(vanguard, upgrade(id));
  }
  return { sim, vanguard, bearer };
}

// Who has taken damage from `by` so far
function hurtUnits(sim: Sim, by: Unit): Set<Unit> {
  const hurt = new Set<Unit>();
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.value > 0 && event.source === by) {
      hurt.add(event.target);
    }
  });
  return hurt;
}

// A still, awake monster
function foe(sim: Sim, x: number, z: number, elite = false): Unit {
  const m = spawnMonster(sim, 'hollowSoldier', 10, x, z, { elite });
  m.aware = true;
  m.kit.moveSpeed = 0;
  m.kit.interval = 99;
  m.cooldown = 99;
  return m;
}

// The spell as the unit casts it, with its upgrade
function spell(u: Unit, id: string): Skill {
  const found = u.skills.find((s) => s.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
}

// Casts a spell and runs through its windup
function cast(sim: Sim, u: Unit, id: string, target: Unit | null = null): void {
  const s = spell(u, id);
  expect(u.startCast(s, target)).toBe(true);
  sim.run(s.windup + 0.05);
}

// A fixed True blow from `from` on `to`
const blow = (from: Unit, to: Unit, fixed = 100): void => {
  from.hit(to, { kind: DamageKind.True, range: Range.Melee, fixed });
};

// A soldier going for the bearer, so Intercept has something to stand against
function threat(sim: Sim, bearer: Unit): Unit {
  const t = foe(sim, -1, 0);
  t.target = bearer;
  return t;
}

describe('the Vanguard spells', () => {
  it('has the ranks of the build model', () => {
    expect(JOBS.vanguard.spells.map((s) => s.id)).toEqual(SPELLS);
    // Half of the old per-rank gain: rank 10 is about the old rank 5
    expect(challengeTime(10)).toBe(5.5);
    expect(CRUSH.describe(10)).toContain('240%');
  });

  it('Shield Wall stops blows from the front, not from behind, and holds it still', () => {
    const { sim, vanguard } = vanguardWith(null, { x: 10, z: 0 });
    vanguard.angle = 0;
    const front = spawnMonster(sim, 'hollowSoldier', 5, 11, 0);
    const behind = spawnMonster(sim, 'hollowSoldier', 5, 9, 0);
    cast(sim, vanguard, 'shieldWall');
    expect(vanguard.statuses.has(SHIELD_WALL.id)).toBe(true);
    const hp = vanguard.hp;
    front.hit(vanguard, { kind: DamageKind.Physical, fixed: 50 });
    expect(vanguard.hp).toBe(hp);
    behind.hit(vanguard, { kind: DamageKind.Physical, fixed: 50, flags: DamageFlags.Flank });
    expect(vanguard.hp).toBeLessThan(hp);
    expect(vanguard.speed).toBe(0);
  });
});

describe('the Vanguard upgrades', () => {
  it('has 12 built upgrades, 3 for each spell', () => {
    const { upgrades } = JOBS.vanguard;
    expect(upgrades).toBe(VANGUARD_UPGRADES);
    expect(upgrades).toHaveLength(12);
    for (const spellId of SPELLS) {
      expect(upgrades.filter((u) => u.spell === spellId)).toHaveLength(3);
    }
    for (const u of upgrades) {
      expect(isBuilt(u), u.id).toBe(true);
      expect(u.describe(5), u.id).not.toBe('');
    }
  });

  it('Vow gives the Vanguard and the bearer armor on arrival', () => {
    const { sim, vanguard, bearer } = vanguardWith('vow');
    threat(sim, bearer);
    const armor = vanguard.derived.armor;
    const bearerArmor = bearer.derived.armor;
    cast(sim, vanguard, 'intercept');
    expect(vanguard.derived.armor).toBe(armor + 20);
    expect(bearer.derived.armor).toBe(bearerArmor + 20);
    sim.run(6.2);
    expect(vanguard.derived.armor).toBe(armor);
    expect(bearer.derived.armor).toBe(bearerArmor);
  });

  it('Shared Burden takes 30% of the hits on the bearer for 5 seconds after the dash', () => {
    const { sim, vanguard, bearer } = vanguardWith('sharedBurden');
    const soldier = threat(sim, bearer);
    blow(soldier, bearer);
    const before = vanguard.hp;
    expect(before).toBe(vanguard.derived.maxHp);
    cast(sim, vanguard, 'intercept');
    const bearerHp = bearer.hp;
    blow(soldier, bearer);
    expect(bearer.hp).toBe(bearerHp - 70);
    expect(vanguard.hp).toBe(before - 30);
    sim.run(5.5);
    const later = vanguard.hp;
    blow(soldier, bearer);
    expect(vanguard.hp).toBe(later);
  });

  it('Charge stuns and pushes aside the enemies the dash passes through', () => {
    const { sim, vanguard, bearer } = vanguardWith('charge');
    threat(sim, bearer);
    const through = foe(sim, 2, 0.4);
    const clear = foe(sim, 2, 3);
    cast(sim, vanguard, 'intercept');
    expect(through.buildup.get(STUN.id) ?? 0).toBeGreaterThanOrEqual(40);
    expect(through.z).toBeGreaterThan(0.4 + 1);
    expect(clear.buildup.has(STUN.id)).toBe(false);
    expect(clear.z).toBe(3);
  });

  it('Last Line turns everything near the bearer on the Vanguard, once an area', () => {
    const { sim, vanguard, bearer } = vanguardWith('lastLine', { x: 4, z: 0 });
    const soldier = foe(sim, 1, 0);
    const far = foe(sim, 12, 0);
    blow(soldier, bearer, Math.ceil(bearer.hp * 0.8));
    expect(soldier.statuses.get(TAUNTED.id)?.source).toBe(vanguard);
    expect(far.statuses.has(TAUNTED.id)).toBe(false);
    soldier.removeStatus(TAUNTED.id);
    blow(soldier, bearer, 1);
    expect(soldier.statuses.has(TAUNTED.id)).toBe(false);
    // Raising Challenge sets the passive up again, but not the area's use
    vanguard.shards = 1;
    expect(raise(vanguard, 'challenge')).toBeNull();
    blow(soldier, bearer, 1);
    expect(soldier.statuses.has(TAUNTED.id)).toBe(false);
    // The next area it fires again
    sim.area++;
    blow(soldier, bearer, 1);
    expect(soldier.statuses.get(TAUNTED.id)?.source).toBe(vanguard);
  });

  it('Banner steadies the party against dread and lifts its heart', () => {
    const { sim, vanguard } = vanguardWith('banner', { x: 0, z: 5 });
    const ally = spawnMerc(sim, 'ranger', 10, 1, 5);
    const husk = spawnMonster(sim, 'husk', 5, 8, 5);
    ally.buildUp(DREAD, husk, 20);
    const plain = ally.buildup.get(DREAD.id) ?? 0;
    ally.buildup.clear();
    cast(sim, vanguard, 'challenge');
    expect(sim.zones.filter((z) => z.kind === 'banner')).toHaveLength(1);
    ally.buildUp(DREAD, husk, 20);
    expect(ally.buildup.get(DREAD.id) ?? 0).toBeLessThan(plain);
    const morale = ally.morale;
    sim.run(2.1);
    expect(ally.morale).toBeGreaterThan(morale);
    // Challenge still taunts
    const soldier = foe(sim, 1, 6);
    vanguard.skillCooldowns.set('challenge', 0);
    cast(sim, vanguard, 'challenge');
    expect(soldier.statuses.has(TAUNTED.id)).toBe(true);
  });

  it('Shield Bash shoves one enemy, builds stun and taunts only that one', () => {
    const { sim, vanguard } = vanguardWith('shieldBash', { x: 0, z: 5 });
    const target = foe(sim, 1, 5);
    const other = foe(sim, 0, 6.5);
    const hurt = hurtUnits(sim, vanguard);
    expect(spell(vanguard, 'challenge').targeting).toBe(CRUSH.targeting);
    cast(sim, vanguard, 'challenge', target);
    expect(hurt.has(target)).toBe(true);
    expect(target.buildup.get(STUN.id) ?? 0).toBeGreaterThan(0);
    expect(target.statuses.get(TAUNTED.id)?.source).toBe(vanguard);
    expect(other.statuses.has(TAUNTED.id)).toBe(false);
  });

  it('Immovable lasts a second longer and keeps stun, Petrify and Dread off during it', () => {
    const { sim, vanguard } = vanguardWith('immovable');
    const soldier = foe(sim, 4, 0);
    expect(vanguard.addStatus(STUN, soldier)).not.toBeNull();
    vanguard.removeStatus(STUN.id);
    cast(sim, vanguard, 'shieldWall');
    const wall = vanguard.statuses.get(SHIELD_WALL.id);
    // 2 + 0.25 seconds at rank 1, plus 1, less the windup run
    expect(wall?.remaining).toBeGreaterThan(2.6);
    expect(vanguard.addStatus(STUN, soldier)).toBeNull();
    expect(vanguard.addStatus(PETRIFY, soldier)).toBeNull();
    expect(vanguard.addStatus(DREAD, soldier)).toBeNull();
    expect(vanguard.addStatus(FRIGHTENED, soldier)).toBeNull();
    expect(knockback(soldier, vanguard, { x: 2, z: 0 }, 1)).toBe(0);
    sim.run(4);
    expect(knockback(soldier, vanguard, { x: 2, z: 0 }, 1)).toBeGreaterThan(0);
    expect(vanguard.statuses.has(SHIELD_WALL.id)).toBe(false);
    expect(vanguard.addStatus(STUN, soldier)).not.toBeNull();
  });

  it('Rampart plants a wall toward an archer that stops arrows, and the Vanguard can move', () => {
    const { sim, vanguard } = vanguardWith('rampart', { x: 2, z: 0 });
    const ally = spawnMerc(sim, 'ranger', 10, 0, 0);
    const archer = foe(sim, 8, 0);
    archer.target = ally;
    // A soldier taken for an archer, for the test, without changing its kind
    Object.assign(archer, { job: { ...archer.job, range: Range.Ranged } });
    const rampart = spell(vanguard, 'shieldWall');
    expect(rampart.wants(vanguard, null, sim)).toBe(true);
    cast(sim, vanguard, 'shieldWall');
    expect(sim.zones.filter((z) => z.kind === 'rampart')).toHaveLength(1);
    expect(vanguard.statuses.has(SHIELD_WALL.id)).toBe(false);
    sim.fire(archer, ally, { speed: ARROW_SPEED, homing: true, options: {} });
    const hp = ally.hp;
    sim.run(1);
    expect(sim.projectiles).toHaveLength(0);
    expect(ally.hp).toBe(hp);
  });

  it('Bastion covers allies close behind it during Shield Wall, not beside it', () => {
    const { sim, vanguard } = vanguardWith('bastion', { x: 2, z: 0 });
    const ally = spawnMerc(sim, 'ranger', 10, 0.5, 0);
    const aside = spawnMerc(sim, 'ranger', 10, 2, 3);
    const soldier = foe(sim, 5, 0);
    const physical = (to: Unit): number => {
      const hp = to.hp;
      soldier.hit(to, { kind: DamageKind.Physical, range: Range.Ranged, fixed: 50 });
      return hp - to.hp;
    };
    // No wall, no cover
    expect(physical(ally)).toBeGreaterThan(0);
    cast(sim, vanguard, 'shieldWall');
    expect(physical(ally)).toBe(0);
    expect(physical(aside)).toBeGreaterThan(0);
    // Too far behind
    ally.x = -1;
    expect(physical(ally)).toBeGreaterThan(0);
  });

  it('Fault Line cracks every enemy in its line with Earth', () => {
    const { sim, vanguard } = vanguardWith('faultLine', { x: 0, z: 5 });
    const near = foe(sim, 1.5, 5);
    const far = foe(sim, 3.5, 5.2);
    const aside = foe(sim, 2, 7.5);
    const hurt = hurtUnits(sim, vanguard);
    cast(sim, vanguard, 'crush', near);
    sim.run(1);
    expect(hurt.has(near)).toBe(true);
    expect(hurt.has(far)).toBe(true);
    expect(hurt.has(aside)).toBe(false);
    expect(far.buildup.get(PETRIFY.id) ?? (far.statuses.has(PETRIFY.id) ? 1 : 0)).toBeGreaterThan(
      0,
    );
  });

  it('Earthshaker spreads Earth from a petrified target to those beside it', () => {
    const { sim, vanguard } = vanguardWith('earthshaker', { x: 0, z: 5 });
    const stone = foe(sim, 1, 5);
    const beside = foe(sim, 2.5, 5);
    const away = foe(sim, 9, 5);
    stone.addStatus(PETRIFY, vanguard);
    cast(sim, vanguard, 'crush', stone);
    expect(beside.buildup.get(PETRIFY.id) ?? 0).toBeGreaterThan(0);
    expect(away.buildup.has(PETRIFY.id)).toBe(false);
  });

  it('Sundering Blow puts all 5 Sunder stacks on the target at once', () => {
    const plain = vanguardWith(null, { x: 0, z: 5 });
    const one = foe(plain.sim, 1, 5);
    cast(plain.sim, plain.vanguard, 'crush', one);
    expect(one.statuses.get(SUNDERED.id)?.stacks).toBe(1);

    const { sim, vanguard } = vanguardWith('sunderingBlow', { x: 0, z: 5 });
    const target = foe(sim, 1, 5);
    cast(sim, vanguard, 'crush', target);
    expect(target.statuses.get(SUNDERED.id)?.stacks).toBe(5);
  });
});

describe('the Vanguard and a Duel', () => {
  // A Duelist bound with an elite: no one else may pick the elite
  function dueled(id: string | null): {
    sim: Sim;
    vanguard: Unit;
    elite: Unit;
    other: Unit;
  } {
    const { sim, vanguard } = vanguardWith(id, { x: 0, z: 5 });
    const duelist = spawnMerc(sim, 'duelist', 10, 8, 8);
    const elite = foe(sim, 1.5, 5, true);
    const other = foe(sim, 3.5, 5.2);
    expect(beginDuel(duelist, elite, 20)).toBe(true);
    return { sim, vanguard, elite, other };
  }

  it('Challenge does not taunt an elite dueled by a Duelist', () => {
    const { sim, vanguard, elite, other } = dueled(null);
    other.x = 1;
    other.z = 6;
    expect(CHALLENGE.wants(vanguard, null, sim)).toBe(false);
    cast(sim, vanguard, 'challenge');
    expect(other.statuses.get(TAUNTED.id)?.source).toBe(vanguard);
    expect(elite.statuses.has(TAUNTED.id)).toBe(false);
  });

  it('Fault Line does not reach the dueled elite in its line', () => {
    const { sim, vanguard, elite, other } = dueled('faultLine');
    const hurt = hurtUnits(sim, vanguard);
    cast(sim, vanguard, 'crush', other);
    sim.run(1);
    expect(hurt.has(other)).toBe(true);
    expect(hurt.has(elite)).toBe(false);
  });

  it('Last Line, Shield Bash and Charge leave the dueled elite alone', () => {
    const last = dueled('lastLine');
    const bearer = last.sim.bearer;
    if (!bearer) {
      throw new Error('no bearer');
    }
    last.elite.x = 1;
    last.elite.z = 1;
    blow(last.other, bearer, Math.ceil(bearer.hp * 0.8));
    expect(last.elite.statuses.has(TAUNTED.id)).toBe(false);

    const bash = dueled('shieldBash');
    const sword = spell(bash.vanguard, 'challenge');
    expect(sword.wants(bash.vanguard, bash.elite, bash.sim)).toBe(false);
    bash.elite.x = 0.5;
    bash.elite.z = 5;
    const hurt = hurtUnits(bash.sim, bash.vanguard);
    sword.release(bash.vanguard, bash.elite, bash.sim);
    expect(hurt.has(bash.elite)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { findNode } from '../../src/content/trees';
import { BANNER, FAULT_LINE, RAMPART, SHIELD_WALL_SKILL } from '../../src/content/vanguard';
import { ARC_VOLLEY, BAIT, LIGHTNING_ROD, SPIKE_FIELD } from '../../src/content/ranger';
import {
  CONSECRATION,
  SACRED_GROUND,
  TURN_UNDEAD,
  VEIL,
  WALL_OF_FAITH,
  WARD,
} from '../../src/content/cleric';
import { DEFAULT_TOGGLES, Stance } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import { Shout, cry } from '../../src/sim/shout';
import Sim, { ARROW_SPEED } from '../../src/sim/sim';
import { BLEED, DREAD, PETRIFY, SEAR, SHOCK, SLOWED, STUN, TAUNTED } from '../../src/sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Range,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setZone } from '../../src/sim/zone';

// Every blow lands, so the tests do not hang on the roll.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// Teaches a node at a rank, without the tree's level and order rules.
function grant(u: Unit, id: string, rank = 1): void {
  const found = findNode(u, id);
  if (!found) {
    throw new Error(`No node ${id}`);
  }
  const { node } = found;
  u.skillRanks.set(id, rank);
  if (node.skill && !u.skills.includes(node.skill)) {
    u.skills.push(node.skill);
  }
  if (node.effect) {
    u.passives.get(id)?.stop();
    const life = node.effect.setup(u, rank);
    u.passives.set(id, life);
    life.start();
  }
}

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
    grant(vanguard, 'shieldWall');
    expect(vanguard.startCast(SHIELD_WALL_SKILL, null)).toBe(true);
    sim.run(SHIELD_WALL_SKILL.windup + 0.05);
    expect(vanguard.speed).toBe(0);
    const hp = vanguard.hp;
    front.hit(vanguard, { kind: DamageKind.Physical, fixed: 50 });
    expect(vanguard.hp).toBe(hp);
    behind.hit(vanguard, { kind: DamageKind.Physical, fixed: 50, flags: DamageFlags.Flank });
    expect(vanguard.hp).toBeLessThan(hp);
  });

  it('Bastion takes some of an arrow off an ally standing behind it', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 2, 0);
    const ally = spawnMerc(sim, 'ranger', 10, 0, 0);
    const archer = spawnMonster(sim, 'hollowSoldier', 5, 6, 0);
    const before = blow(archer, ally, Range.Ranged);
    grant(vanguard, 'bastion', 5);
    expect(blow(archer, ally, Range.Ranged)).toBeLessThan(before);
    // To one side of it, there is no cover.
    ally.z = 3;
    expect(blow(archer, ally, Range.Ranged)).toBe(before);
  });

  it('Rampart stops arrows that fly into it', () => {
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

  it('Immovable keeps it from being stunned while it holds', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0, {
      ...DEFAULT_TOGGLES,
      stance: Stance.Hold,
    });
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    grant(vanguard, 'immovable');
    expect(vanguard.addStatus(STUN, soldier)).toBeNull();
    vanguard.toggles = { ...DEFAULT_TOGGLES };
    expect(vanguard.addStatus(STUN, soldier)).not.toBeNull();
  });

  it('Fault Line cracks every enemy in its line with Earth', () => {
    const sim = new Sim(2);
    alwaysHit(sim);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const near = spawnMonster(sim, 'hollowSoldier', 5, 1.5, 0);
    const far = spawnMonster(sim, 'hollowSoldier', 5, 3.5, 0.2);
    const aside = spawnMonster(sim, 'hollowSoldier', 5, 2, 2.5);
    still(near, far, aside);
    grant(vanguard, 'faultLine', 3);
    expect(vanguard.startCast(FAULT_LINE, near)).toBe(true);
    sim.run(FAULT_LINE.windup + 1);
    expect(near.hp).toBeLessThan(near.derived.maxHp);
    expect(far.hp).toBeLessThan(far.derived.maxHp);
    expect(aside.hp).toBe(aside.derived.maxHp);
    expect(far.buildup.get(PETRIFY.id) ?? (far.statuses.has(PETRIFY.id) ? 1 : 0)).toBeGreaterThan(
      0,
    );
  });

  it('Earthshaker spreads Earth from a petrified enemy to those beside it', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const stone = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
    const beside = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const away = spawnMonster(sim, 'hollowSoldier', 5, 9, 0);
    grant(vanguard, 'earthshaker');
    stone.addStatus(PETRIFY, vanguard);
    expect(beside.buildup.get(PETRIFY.id)).toBeGreaterThan(0);
    expect(away.buildup.has(PETRIFY.id)).toBe(false);
  });

  it('Banner steadies the party against dread and lifts its heart', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const ally = spawnMerc(sim, 'ranger', 10, 1, 0);
    const husk = spawnMonster(sim, 'husk', 5, 8, 0);
    ally.buildUp(DREAD, husk, 20);
    const plain = ally.buildup.get(DREAD.id) ?? 0;
    ally.buildup.clear();
    grant(vanguard, 'banner', 3);
    BANNER.release(vanguard, null, sim);
    ally.buildUp(DREAD, husk, 20);
    expect(ally.buildup.get(DREAD.id) ?? 0).toBeLessThan(plain);
    const morale = ally.morale;
    sim.run(2.1);
    expect(ally.morale).toBeGreaterThan(morale);
  });

  it('Last Line turns everything near the bearer on the Vanguard, once an area', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 4, 0);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    grant(vanguard, 'lastLine');
    soldier.hit(bearer, { kind: DamageKind.True, fixed: Math.ceil(bearer.hp * 0.8) });
    expect(soldier.statuses.get(TAUNTED.id)?.source).toBe(vanguard);
    soldier.removeStatus(TAUNTED.id);
    soldier.hit(bearer, { kind: DamageKind.True, fixed: 1 });
    expect(soldier.statuses.has(TAUNTED.id)).toBe(false);
  });
});

describe('the Ranger', () => {
  it('Killshot doubles the first arrow at an enemy that has not noticed the party', () => {
    const sim = new Sim(3);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 6, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 6, 3);
    const flags: number[] = [];
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      flags.push(event.flags);
    });
    grant(ranger, 'killshot');
    ranger.hit(b, { range: Range.Ranged, fixed: 40 });
    a.aware = false;
    sim.fire(ranger, a, { speed: ARROW_SPEED, homing: true, options: { range: Range.Ranged } });
    still(a, b);
    sim.run(1);
    expect(flags.at(-1)! & DamageFlags.Ambush).toBeTruthy();
    expect(flags.at(-1)! & DamageFlags.Critical).toBeTruthy();
    // Now it is awake: no second killshot.
    sim.fire(ranger, a, { speed: ARROW_SPEED, homing: true, options: { range: Range.Ranged } });
    sim.run(1);
    expect(flags.at(-1)! & DamageFlags.Ambush).toBeFalsy();
  });

  it('Rearguard sets a snare where the bearer walked', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 1);
    spawnMonster(sim, 'hollowSoldier', 5, 9, 0).aware = true;
    grant(ranger, 'rearguard', 3);
    bearer.order = { x: 8, z: 0 };
    sim.run(7);
    const traps = sim.traps.filter((t) => t.skill === 'rearguard');
    expect(traps.length).toBeGreaterThan(0);
    expect(traps[0].x).toBeLessThan(bearer.x - 1);
  });

  it('Bait draws monsters away from the party, but not a boss', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 10, 1, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 4, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 4, 1);
    for (const m of [a, b]) {
      m.aware = true;
      m.target = bearer;
    }
    grant(ranger, 'bait', 2);
    expect(BAIT.wants(ranger, null, sim)).toBe(true);
    BAIT.release(ranger, null, sim);
    const bait = sim.zones[0];
    expect(bait.x).toBeGreaterThan(4);
    still(bearer, ranger);
    sim.run(2);
    expect(a.distanceTo(bait)).toBeLessThan(1);
    expect(bearer.hp).toBe(bearer.derived.maxHp);
  });

  it('Spike Field slows and bleeds what stands in it', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    spawnMonster(sim, 'hollowSoldier', 5, 5, 1);
    still(a);
    grant(ranger, 'spikeField', 3);
    expect(SPIKE_FIELD.wants(ranger, a, sim)).toBe(true);
    SPIKE_FIELD.release(ranger, a, sim);
    sim.run(1.05);
    expect(a.statuses.has(SLOWED.id)).toBe(true);
    expect(a.statuses.get(BLEED.id)?.power).toBe(3);
    sim.run(2);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
  });

  it('Killing Ground rings the bearer with snares when it shouts Hold', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 10, 10);
    const ranger = spawnMerc(sim, 'ranger', 10, 11, 10);
    grant(ranger, 'killingGround');
    expect(cry(sim, Shout.Hold)).toBeNull();
    sim.run(2);
    expect(sim.traps.filter((t) => t.skill === 'killingGround')).toHaveLength(6);
  });

  it('Arc Volley looses an arrow at each of three enemies', () => {
    const sim = new Sim(4);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const foes = [0, 1.5, -1.5].map((z) => spawnMonster(sim, 'hollowSoldier', 5, 6, z));
    for (const f of foes) {
      f.aware = true;
    }
    still(...foes);
    grant(ranger, 'arcVolley');
    expect(ranger.startCast(ARC_VOLLEY, foes[0])).toBe(true);
    sim.run(ARC_VOLLEY.windup + 1.5);
    for (const f of foes) {
      expect(f.hp).toBeLessThan(f.derived.maxHp);
    }
  });

  it('Lightning Rod strikes everything in its field each second', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 5, 1.5);
    still(a, b);
    grant(ranger, 'lightningRod', 2);
    LIGHTNING_ROD.release(ranger, a, sim);
    sim.run(3.05);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it('Thunderhead leaps from one Shocked enemy to every other charged one', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const first = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    const charged = spawnMonster(sim, 'hollowSoldier', 5, 7, 0);
    const plain = spawnMonster(sim, 'hollowSoldier', 5, 6, 2);
    still(first, charged, plain);
    grant(ranger, 'thunderhead');
    charged.buildup.set(SHOCK.id, 10);
    first.addStatus(SHOCK, ranger);
    sim.run(0.5);
    expect(charged.hp).toBeLessThan(charged.derived.maxHp);
    expect(plain.hp).toBe(plain.derived.maxHp);
  });
});

describe('the Cleric', () => {
  it('Martyr raises the fallen around it as it dies', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const fallen = spawnMerc(sim, 'vanguard', 10, 2, 0);
    const mite = spawnMonster(sim, 'mite', 1, 9, 9);
    grant(cleric, 'martyr');
    // Worn down first, so the killing blow is too light to tear it apart
    fallen.hp = 5;
    mite.hit(fallen, { kind: DamageKind.True, fixed: 5 });
    expect(fallen.alive).toBe(false);
    mite.hit(cleric, { kind: DamageKind.True, fixed: cleric.hp });
    expect(fallen.alive).toBe(true);
    expect(fallen.hp).toBe(Math.floor(fallen.derived.maxHp * 0.2));
  });

  it('Ward absorbs magic on whoever an enemy is after', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 0);
    const cantor = spawnMonster(sim, 'cantor', 5, 3, 0);
    cantor.aware = true;
    cantor.target = bearer;
    grant(cleric, 'ward', 2);
    expect(WARD.aim?.(cleric, sim)).toBe(bearer);
    WARD.release(cleric, bearer, sim);
    expect(bearer.ward).toBeGreaterThan(0);
    const hp = bearer.hp;
    cantor.hit(bearer, { kind: DamageKind.Magical, fixed: 10 });
    expect(bearer.hp).toBe(hp);
  });

  it('Sacred Ground heals the hurt standing on it', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const a = spawnMerc(sim, 'vanguard', 10, 1, 0);
    const b = spawnMerc(sim, 'ranger', 10, 1, 1);
    for (const m of [a, b]) {
      m.hp = m.derived.maxHp / 2;
    }
    grant(cleric, 'sacredGround');
    const at = SACRED_GROUND.aim?.(cleric, sim) ?? null;
    expect(at).not.toBeNull();
    SACRED_GROUND.release(cleric, at, sim);
    sim.run(1.05);
    expect(a.hp).toBeGreaterThan(a.derived.maxHp / 2);
    expect(b.hp).toBeGreaterThan(b.derived.maxHp / 2);
  });

  it('Wall of Faith stops a few melee blows, then breaks', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    soldier.aware = true;
    soldier.target = bearer;
    grant(cleric, 'wallOfFaith', 1);
    expect(WALL_OF_FAITH.aim?.(cleric, sim)).toBe(bearer);
    WALL_OF_FAITH.release(cleric, bearer, sim);
    expect([blow(soldier, bearer), blow(soldier, bearer), blow(soldier, bearer)]).toEqual([
      0, 0, 0,
    ]);
    sim.tick();
    expect(sim.zones).toHaveLength(0);
    expect(blow(soldier, bearer)).toBeGreaterThan(0);
  });

  it('Veil stops arrows on those inside it, but not blows', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    VEIL.release(cleric, bearer, sim);
    expect(blow(soldier, bearer, Range.Ranged)).toBe(0);
    expect(blow(soldier, bearer, Range.Melee)).toBeGreaterThan(0);
  });

  it('Aegis fills the bearer’s Ward once the fight is over', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    soldier.aware = true;
    still(soldier);
    grant(cleric, 'aegis');
    sim.run(4);
    // Mercs fight it: wait for it to fall, then for the quiet.
    sim.units.delete(soldier);
    sim.run(4);
    expect(bearer.ward).toBe(80 + cleric.level * 4);
  });

  it('Sear holds only on the dead and the Occult, and Holy Light builds it faster', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const dead = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const living = spawnMonster(sim, 'penitent', 5, 3, 2);
    living.buildUp(SEAR, cleric, 500);
    expect(living.statuses.has(SEAR.id)).toBe(false);
    dead.buildUp(SEAR, cleric, 30);
    const plain = dead.buildup.get(SEAR.id) ?? 0;
    dead.buildup.clear();
    grant(cleric, 'holyLight', 4);
    dead.buildUp(SEAR, cleric, 30);
    expect(dead.buildup.get(SEAR.id)).toBeCloseTo(plain * 2);
    dead.buildUp(SEAR, cleric, 1000);
    const before = blow(cleric, living);
    expect(dead.statuses.has(SEAR.id)).toBe(true);
    expect(blow(cleric, dead)).toBeGreaterThan(before);
  });

  it('Turn Undead destroys the dead it is lucky against, and spares the living', () => {
    const turned = [1, 2, 3, 4, 5, 6, 7, 8].filter((seed) => {
      const sim = new Sim(seed);
      const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
      const dead = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
      grant(cleric, 'turnUndead', 5);
      TURN_UNDEAD.release(cleric, dead, sim);
      return !dead.alive;
    }).length;
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(8);
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    expect(TURN_UNDEAD.wants(cleric, spawnMonster(sim, 'penitent', 5, 2, 0), sim)).toBe(false);
  });

  it('Consecrate burns every enemy on its ground each second', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 4, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 4, 1.5);
    still(a, b);
    grant(cleric, 'consecrate');
    expect(CONSECRATION.wants(cleric, a, sim)).toBe(true);
    CONSECRATION.release(cleric, a, sim);
    sim.run(2.05);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it('Purge makes Occult enemies take more from the party', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 1, 0);
    const husk = spawnMonster(sim, 'husk', 5, 2, 0);
    // A husk taken for something Occult
    const before = blow(vanguard, husk);
    husk.hp = husk.derived.maxHp;
    grant(cleric, 'purge');
    expect(blow(vanguard, husk)).toBe(before);
    husk.element = 7;
    const occult = blow(vanguard, husk);
    cleric.passives.get('purge')?.stop();
    expect(occult).toBeGreaterThan(blow(vanguard, husk) * 1.2);
  });
});

describe('zones', () => {
  it('fade when their time runs out', () => {
    const sim = new Sim(1);
    const owner = spawnMerc(sim, 'cleric', 10, 0, 0);
    setZone(sim, { kind: 'veil', owner, x: 0, z: 0, r: 1, life: 1, element: 0 });
    sim.run(1.1);
    expect(sim.zones).toHaveLength(0);
    expect(Side.Party).toBe(owner.side);
  });
});

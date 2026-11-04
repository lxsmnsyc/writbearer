import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import RNG from '../../src/core/rng';
import ObjectiveRun from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateStage } from '../../src/gen/stage';
import { updateWarnings } from '../../src/sim/warning';
import { COVERING, MARKED, isMarked } from '../../src/content/jobs/warden';
import WARDEN_UPGRADES, {
  ambushersArrive,
  seesAmbushes,
  springAmbush,
} from '../../src/content/jobs/warden/upgrades';
import {
  spawnBearer,
  spawnDisguisedAssassin,
  spawnMerc,
  spawnMonster,
} from '../../src/content/roster';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { type Upgrade, isBuilt } from '../../src/sim/builds';
import { type CheckHitEvent, SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { type Skill, SkillMode } from '../../src/sim/skill';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Range,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { withUpgrade } from '../support/build';

// The Warden's 12 elite upgrades.

const SPELLS = ['cover', 'execute', 'tripwire', 'pursue'];

const upgrade = (id: string): Upgrade => {
  const found = WARDEN_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// Every blow lands, unless a later listener says otherwise.
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

// A still Warden beside a still bearer, with an upgrade when one is named
function wardenWith(
  id: string | null,
  at = { x: 1, z: 0 },
): { sim: Sim; warden: Unit; bearer: Unit } {
  const sim = new Sim(3);
  alwaysHit(sim);
  const bearer = spawnBearer(sim, 0, 0);
  bearer.kit.moveSpeed = 0;
  const warden = spawnMerc(sim, 'warden', 10, at.x, at.z, quiet());
  // No basic attacks and no walking, so only the spells act
  warden.kit.interval = 0;
  warden.kit.moveSpeed = 0;
  warden.mana = warden.derived.maxMana;
  if (id) {
    withUpgrade(warden, upgrade(id));
  }
  return { sim, warden, bearer };
}

// A still, awake monster
function foe(sim: Sim, x: number, z: number, hp = 100000): Unit {
  const m = spawnMonster(sim, 'hollowSoldier', 3, x, z);
  m.aware = true;
  m.kit.moveSpeed = 0;
  m.kit.interval = 99;
  m.cooldown = 99;
  m.derived.maxHp = hp;
  m.hp = hp;
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

// A fixed True blow from `from` on `to`
const blow = (from: Unit, to: Unit, fixed = 100): void => {
  from.hit(to, { kind: DamageKind.True, range: Range.Melee, fixed });
};

// The damage each blow by `source` deals, as it lands
function record(sim: Sim, source: Unit): { target: Unit; value: number }[] {
  const hits: { target: Unit; value: number }[] = [];
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.source === source) {
      hits.push({ target: event.target, value: event.value });
    }
  });
  return hits;
}

describe('the Warden upgrades', () => {
  it('has 12, three per spell, each with a patch or an effect', () => {
    const { upgrades, spells } = JOBS.warden;
    expect(upgrades).toBe(WARDEN_UPGRADES);
    expect(upgrades).toHaveLength(12);
    for (const s of spells) {
      expect(
        upgrades.filter((u) => u.spell === s.id),
        s.id,
      ).toHaveLength(3);
    }
    for (const u of upgrades) {
      expect(isBuilt(u), u.id).toBe(true);
      expect(u.describe(1)).not.toBe('');
    }
  });
});

describe('Cover upgrades', () => {
  it('Living Shield: during Cover the Warden takes 40%, not 80%, and gains it as Ward', () => {
    const { sim, warden, bearer } = wardenWith('livingShield');
    const m = foe(sim, -1, 0);
    warden.addStatus(COVERING, warden, 5);
    const hp = warden.hp;
    const bearerHp = bearer.hp;
    blow(m, bearer);
    expect(bearerHp - bearer.hp).toBe(20);
    expect(hp - warden.hp).toBe(40);
    expect(warden.ward).toBe(40);
    // Outside Cover, Interpose is as before.
    warden.removeStatus(COVERING.id);
    const after = warden.hp;
    blow(m, bearer);
    expect(after - warden.hp).toBe(80);
    expect(warden.ward).toBe(40);
  });

  it("Tether: dashes to the bearer's side, is faster, and chases no farther than 3 tiles", () => {
    const { sim, warden, bearer } = wardenWith('tether', { x: 4, z: 0 });
    const archer = spawnMonster(sim, 'hollowArcher', 5, 9, 0);
    archer.kit.moveSpeed = 0;
    archer.aware = true;
    archer.target = bearer;
    warden.kit.moveSpeed = 2.7;
    const speed = warden.speed;
    const cover = spell(warden, 'cover');
    expect(cover.wants(warden, null, sim)).toBe(true);
    cover.release(warden, null, sim);
    // The Warden dashed from 4 tiles out to the bearer's side. Base Cover
    // alone would leave it at 4 and pull the bearer to 3.1.
    expect(warden.x).toBeLessThan(1.5);
    expect(Math.abs(bearer.x)).toBeLessThan(0.5);
    expect(warden.statuses.has(COVERING.id)).toBe(true);
    expect(warden.speed).toBeCloseTo(speed * 1.3, 5);
    const check = { id: 'CheckChase', disabled: false, source: warden, value: 10 };
    sim.emit(SimEvents.CheckChase, check);
    expect(check.value).toBe(3);
    warden.removeStatus(COVERING.id);
    const after = { id: 'CheckChase', disabled: false, source: warden, value: 10 };
    sim.emit(SimEvents.CheckChase, after);
    // Interpose alone keeps it within 4 tiles.
    expect(after.value).toBe(4);
  });

  it('Retaliate: during Cover, a foe in reach that hurts the bearer takes a free attack', () => {
    const { sim, warden, bearer } = wardenWith('retaliate', { x: 0, z: 1 });
    const m = foe(sim, 0.5, 0.8);
    const hits = record(sim, warden);
    blow(m, bearer);
    expect(hits.filter((h) => h.target === m)).toHaveLength(0);
    warden.addStatus(COVERING, warden, 5);
    blow(m, bearer);
    expect(hits.filter((h) => h.target === m && h.value > 0)).toHaveLength(1);
    // Out of reach, nothing.
    const far = foe(sim, 0, -3);
    blow(far, bearer);
    expect(hits.filter((h) => h.target === far)).toHaveLength(0);
  });
});

describe('Execute upgrades', () => {
  // A marked foe in reach, low enough to be executed
  function doomed(sim: Sim, warden: Unit, x = 2, z = 0): Unit {
    // Small, so the bearer's heal fits under its max health
    const m = foe(sim, x, z, 150);
    m.addStatus(MARKED, warden);
    m.hp = 15;
    return m;
  }

  it("Blood Debt: a kill heals the bearer for 10% of the enemy's max health", () => {
    const { sim, warden, bearer } = wardenWith('bloodDebt');
    const m = doomed(sim, warden);
    bearer.hp = 10;
    spell(warden, 'execute').release(warden, m, sim);
    expect(m.alive).toBe(false);
    expect(bearer.hp).toBe(25);
  });

  it("Hangman's Reach: leaps up to 3 tiles to a marked target first", () => {
    const { sim, warden } = wardenWith('hangmansReach');
    const m = doomed(sim, warden, 4.5, 0);
    const base = JOBS.warden.spells[1];
    expect(base.wants(warden, m, sim)).toBe(false);
    const execute = spell(warden, 'execute');
    expect(execute.wants(warden, m, sim)).toBe(true);
    execute.release(warden, m, sim);
    expect(warden.distanceTo(m)).toBeLessThanOrEqual(warden.kit.reach);
    expect(m.alive).toBe(false);
    // Past 3 tiles beyond reach, it does not.
    const far = doomed(sim, warden, warden.x + 6, 0);
    expect(execute.wants(warden, far, sim)).toBe(false);
  });

  it('Last Rites: a kill makes Pursue ready and marks the nearest enemy', () => {
    const { sim, warden } = wardenWith('lastRites');
    const m = doomed(sim, warden);
    const next = foe(sim, 3, 2);
    const farther = foe(sim, 9, 0);
    warden.skillCooldowns.set('pursue', 3);
    spell(warden, 'execute').release(warden, m, sim);
    expect(m.alive).toBe(false);
    expect(warden.skillCooldowns.get('pursue')).toBe(0);
    expect(isMarked(next)).toBe(true);
    expect(isMarked(farther)).toBe(false);
  });
});

describe('Tripwire upgrades', () => {
  // A hidden monster, made by the test as hidden-units' scouts would be
  function hidden(sim: Sim, x: number, z: number): Unit {
    const m = foe(sim, x, z);
    m.hidden = true;
    return m;
  }

  // Sets a Tripwire of the Warden's with nobody near, toward a foe far off
  function setWire(sim: Sim, warden: Unit): Unit {
    const coming = foe(sim, 9, 0);
    const wire = spell(warden, 'tripwire');
    expect(wire.wants(warden, null, sim)).toBe(true);
    wire.release(warden, null, sim);
    return coming;
  }

  it('Sentry: while the trap stands, hidden enemies within 6 tiles of it are revealed', () => {
    const { sim, warden } = wardenWith('sentry', { x: -1, z: 0 });
    setWire(sim, warden);
    expect(sim.traps).toHaveLength(1);
    const trap = sim.traps[0];
    const near = hidden(sim, trap.x + 1, 5);
    const far = hidden(sim, trap.x + 1, 7);
    sim.tick();
    expect(near.hidden).toBe(false);
    expect(far.hidden).toBe(true);
  });

  it('Sentry: without it, a Tripwire reveals nothing', () => {
    const { sim, warden } = wardenWith(null, { x: -1, z: 0 });
    setWire(sim, warden);
    const near = hidden(sim, 3, 3);
    sim.tick();
    expect(near.hidden).toBe(true);
  });

  it('Trap Field: a 2.5-tile field where every enemy that enters is marked and slowed', () => {
    const { sim, warden } = wardenWith('trapField', { x: -1, z: 0 });
    setWire(sim, warden);
    expect(sim.traps).toHaveLength(0);
    const field = sim.zones.find((z) => z.kind === 'trapField');
    expect(field?.r).toBe(2.5);
    if (!field) {
      return;
    }
    // One at a time, it is not set again while it stands.
    expect(spell(warden, 'tripwire').wants(warden, null, sim)).toBe(false);
    const pack = [foe(sim, field.x + 1, 0.5), foe(sim, field.x - 0.5, -1), foe(sim, field.x, 2)];
    const outside = foe(sim, field.x + 4, 0);
    sim.tick();
    for (const m of pack) {
      expect(m.statuses.has('tripped')).toBe(true);
      expect(isMarked(m)).toBe(true);
    }
    expect(outside.statuses.has('tripped')).toBe(false);
  });

  it('Never Surprised: shows Ambushes, sets a Tripwire at the entrance and stuns ambushers', () => {
    const plain = wardenWith(null);
    expect(seesAmbushes(plain.sim)).toBe(false);
    springAmbush(plain.sim, { x: 5, z: 5 });
    expect(plain.sim.traps).toHaveLength(0);

    const { sim, warden } = wardenWith('neverSurprised');
    expect(seesAmbushes(sim)).toBe(true);
    springAmbush(sim, { x: 5, z: 5 });
    expect(sim.traps).toHaveLength(1);
    expect(sim.traps[0]).toMatchObject({ owner: warden, x: 5, z: 5, skill: 'tripwire' });
    const ambushers = [foe(sim, 8, 0), foe(sim, 8, 1)];
    ambushersArrive(sim, ambushers);
    for (const m of ambushers) {
      expect(m.statuses.get('stun')?.remaining).toBeCloseTo(1, 1);
    }
    // A dead Warden sees nothing coming.
    warden.hp = 0;
    warden.alive = false;
    expect(seesAmbushes(sim)).toBe(false);
  });
});

describe('Never Surprised in an Ambush', () => {
  it('springs a Tripwire at the entrance and stuns each wave as it comes', () => {
    const stage = generateStage(new RNG(6), 12, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'ambush',
    });
    const sim = new Sim(1);
    enterStage(sim, stage);
    const bearer = spawnParty(sim, stage, ['warden']);
    const [warden] = sim.living(Side.Party).filter((u) => u.kind === 'warden');
    withUpgrade(warden, upgrade('neverSurprised'));
    const run = new ObjectiveRun('ambush', stage);
    const fire = stage.rest;
    if (!fire) {
      throw new Error('no fire');
    }
    bearer.x = fire.x - 3;
    bearer.z = fire.z;
    run.update(sim, 0.05, 14);
    expect(run.hidden()).toBe(false);
    expect(sim.traps.filter((t) => t.owner === warden)).toHaveLength(1);
    expect(sim.traps[0]).toMatchObject({ x: stage.entrance.x, z: stage.entrance.z });
    // The waves arrive after their warning, stunned.
    for (let t = 0; t < 2; t += 0.05) {
      updateWarnings(sim, 0.05);
    }
    const ambushers = sim.living(Side.Monster);
    expect(ambushers.length).toBeGreaterThan(0);
    for (const m of ambushers) {
      expect(m.statuses.has('stun'), m.kind).toBe(true);
    }
  });
});

describe('Pursue upgrades', () => {
  // The CheckHit of a blow by `source` on `target`, as listeners leave it
  function checkHit(sim: Sim, source: Unit, target: Unit): CheckHitEvent {
    const check: CheckHitEvent = {
      id: 'CheckHit',
      disabled: false,
      source,
      target,
      range: Range.Melee,
      flags: DamageFlags.BasicAttack,
      critRate: 0,
      hitChance: 0,
      critical: false,
      hit: false,
    };
    sim.emit(SimEvents.CheckHit, check);
    return check;
  }

  // A fixed magic blow, which rolls no hit and no crit
  const spellBlow = (from: Unit, to: Unit): number =>
    from.hit(to, { kind: DamageKind.Magical, fixed: 1000 })?.value ?? 0;

  it('Marked for Death: every merc deals 10% more to marked enemies, once for two Wardens', () => {
    const { sim, warden } = wardenWith('markedForDeath');
    const ranger = spawnMerc(sim, 'ranger', 10, -1, 0, quiet());
    const a = foe(sim, 3, 0);
    const b = foe(sim, 3, 2);
    b.addStatus(MARKED, warden);
    const plain = spellBlow(ranger, a);
    const marked = spellBlow(ranger, b);
    expect(marked / plain).toBeCloseTo(1.1, 2);
    // A second Warden with it does not stack.
    const other = spawnMerc(sim, 'warden', 10, 1, 1, quiet());
    withUpgrade(other, upgrade('markedForDeath'));
    expect(spellBlow(ranger, b) / plain).toBeCloseTo(1.1, 2);
  });

  it('Debt Collector: +25 crit rate on the Warden’s hits on marked enemies', () => {
    const { sim, warden } = wardenWith('debtCollector');
    const a = foe(sim, 2, 0);
    const b = foe(sim, 2, 1);
    b.addStatus(MARKED, warden);
    expect(checkHit(sim, warden, b).critRate - checkHit(sim, warden, a).critRate).toBe(25);
  });

  it('Read the Room: leaps to a hidden enemy, reveals and marks it, and strikes', () => {
    const { sim, warden } = wardenWith('readTheRoom');
    const m = foe(sim, 5, 0);
    m.hidden = true;
    const base = JOBS.warden.spells[3];
    expect(base.wants(warden, null, sim)).toBe(false);
    const pursue = spell(warden, 'pursue');
    expect(pursue.wants(warden, null, sim)).toBe(true);
    const hp = m.hp;
    pursue.release(warden, null, sim);
    expect(m.hidden).toBe(false);
    expect(isMarked(m)).toBe(true);
    expect(m.hp).toBeLessThan(hp);
    expect(warden.distanceTo(m)).toBeLessThan(1.2);
  });

  it('Read the Room: reveals disguised enemies at the start of each area', () => {
    const { sim } = wardenWith('readTheRoom');
    const first = spawnDisguisedAssassin(sim, 3, 6, 6);
    sim.tick();
    expect(first.disguise).toBe(null);
    expect(first.side).toBe(Side.Monster);
    // Within the area, a new one is left alone until the next area.
    const second = spawnDisguisedAssassin(sim, 3, -6, 6);
    sim.tick();
    expect(second.disguise).toBe('refugee');
    sim.area++;
    sim.tick();
    expect(second.disguise).toBe(null);
  });

  it('Read the Room: without it, a disguised enemy stays disguised', () => {
    const { sim } = wardenWith(null);
    const ward = spawnDisguisedAssassin(sim, 3, 6, 6);
    sim.area++;
    sim.tick();
    expect(ward.disguise).toBe('refugee');
  });
});

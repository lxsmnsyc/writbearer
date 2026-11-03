import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import {
  ELEMENTAL_SENSE,
  FIREBALL,
  FIREBOLT,
  FROST_NOVA,
  FROST_SHARD,
  NOVA_RADIUS,
  fireballRatio,
  fireboltBurn,
  fireboltRatio,
  novaChill,
  novaRatio,
  senseElement,
  shardRatio,
} from '../../src/content/jobs/arcanist/spells';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES, Priority, type Toggles } from '../../src/sim/ai';
import { affinity } from '../../src/sim/elements';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { BURN, CHILL, FREEZE } from '../../src/sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setRank } from '../support/build';

// The Arcanist: Frost Nova, Fireball, Frost Shard, Firebolt and the innate
// Elemental Sense.

const SPELLS = ['frostNova', 'fireball', 'frostShard', 'firebolt'];

// Every blow lands, except where a test says otherwise.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// Orders with every spell off except the ones named
function toggles(...on: string[]): Toggles {
  const skills: Toggles['skills'] = {};
  for (const id of SPELLS) {
    skills[id] = on.includes(id) ? SkillMode.Auto : SkillMode.Off;
  }
  return { ...DEFAULT_TOGGLES, skills };
}

interface Landed {
  target: Unit;
  element: Element;
  kind: DamageKind;
  ratio: number;
  flags: number;
  value: number;
}

const byId = (a: Unit, b: Unit): number => a.x - b.x || a.z - b.z;

// The hits a unit lands, as they land
function record(sim: Sim, source: Unit): Landed[] {
  const hits: Landed[] = [];
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.source === source) {
      hits.push({
        target: event.target,
        element: event.element,
        kind: event.kind,
        ratio: event.ratio,
        flags: event.flags,
        value: event.value,
      });
    }
  });
  return hits;
}

// The spells a unit releases, in order
function released(sim: Sim, source: Unit): string[] {
  const out: string[] = [];
  sim.on(SimEvents.UnitSkillRelease, 0, (event) => {
    if (event.source === source) {
      out.push(event.skill.id);
    }
  });
  return out;
}

// An Arcanist and a still, tough target of a given defense element
function duel(element: Element, level = 1): { sim: Sim; arcanist: Unit; target: Unit } {
  const sim = new Sim(3);
  alwaysHit(sim);
  spawnBearer(sim, 0, 0);
  const arcanist = spawnMerc(sim, 'arcanist', 8, 1, 0, toggles('frostShard', 'firebolt'));
  const target = spawnMonster(sim, 'hollowSoldier', 3, 4, 0);
  target.element = element;
  target.elementLevel = level;
  target.aware = true;
  target.kit.moveSpeed = 0;
  target.kit.interval = 99;
  target.derived.maxHp = 100000;
  target.hp = 100000;
  arcanist.kit.interval = 99;
  return { sim, arcanist, target };
}

describe('Elemental Sense', () => {
  it('casts Firebolt at a target that takes more from Fire', () => {
    const { sim, arcanist, target } = duel(Element.Earth);
    expect(affinity(Element.Fire, target.element, 1)).toBeGreaterThan(
      affinity(Element.Frost, target.element, 1),
    );
    expect(senseElement(target)).toBe(Element.Fire);
    const cast = released(sim, arcanist);
    const hits = record(sim, arcanist);
    sim.run(3);
    expect(cast[0]).toBe('firebolt');
    expect(cast).not.toContain('frostShard');
    // The damage calculation applies the Fire affinity to the bolt.
    const bolt = hits.find((h) => h.flags & DamageFlags.Skill);
    expect(bolt?.element).toBe(Element.Fire);
    expect(bolt?.kind).toBe(DamageKind.Magical);
    expect(bolt?.ratio).toBe(fireboltRatio(1));
  });

  it('casts Frost Shard at a target that takes more from Frost', () => {
    const { sim, arcanist, target } = duel(Element.Fire);
    expect(affinity(Element.Frost, target.element, 1)).toBeGreaterThan(
      affinity(Element.Fire, target.element, 1),
    );
    expect(senseElement(target)).toBe(Element.Frost);
    const cast = released(sim, arcanist);
    const hits = record(sim, arcanist);
    sim.run(3);
    expect(cast[0]).toBe('frostShard');
    expect(cast).not.toContain('firebolt');
    const bolt = hits.find((h) => h.flags & DamageFlags.Skill);
    expect(bolt?.element).toBe(Element.Frost);
    expect(bolt?.ratio).toBe(shardRatio(1));
  });

  it('casts Firebolt at a target that takes neither more', () => {
    for (const element of [Element.Neutral, Element.Radiant, Element.Occult]) {
      const { sim, arcanist, target } = duel(element);
      expect(affinity(Element.Fire, target.element, 1)).toBe(100);
      expect(affinity(Element.Frost, target.element, 1)).toBe(100);
      expect(senseElement(target)).toBe(Element.Fire);
      const cast = released(sim, arcanist);
      sim.run(3);
      expect(cast[0], String(element)).toBe('firebolt');
      expect(cast).not.toContain('frostShard');
    }
  });

  it('deals the affinity of the picked bolt, not the other', () => {
    // The same bolt at the same rank hits a Fire target for the Frost affinity
    // (150) and a Neutral one for 100, over the same base roll.
    const fire = duel(Element.Fire);
    const neutral = duel(Element.Neutral);
    const hitsFire = record(fire.sim, fire.arcanist);
    const hitsNeutral = record(neutral.sim, neutral.arcanist);
    // Both are 3 levels of armor from the same soldier, so only affinity differs.
    fire.sim.run(2);
    neutral.sim.run(2);
    const a = hitsFire.find((h) => h.flags & DamageFlags.Skill);
    const b = hitsNeutral.find((h) => h.flags & DamageFlags.Skill);
    expect(a?.element).toBe(Element.Frost);
    expect(b?.element).toBe(Element.Fire);
    expect(a && b && a.value > b.value).toBe(true);
  });

  it('follows a target that changes element: a Frozen enemy is hit with Fire', () => {
    const { sim, arcanist, target } = duel(Element.Fire);
    const cast = released(sim, arcanist);
    expect(senseElement(target)).toBe(Element.Frost);
    // A frozen unit counts as Frost 1, so it now takes more from Fire.
    target.addStatus(FREEZE, arcanist, 30);
    expect(senseElement(target)).toBe(Element.Fire);
    sim.run(2);
    expect(cast[0]).toBe('firebolt');
  });

  it('adds Fire and Frost to the weak-to-my-element priority', () => {
    const sim = new Sim(4);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const order: Toggles = {
      ...toggles(),
      priorities: [Priority.WeakToElement, Priority.Nearest],
    };
    const arcanist = spawnMerc(sim, 'arcanist', 8, 0, 1, order);
    // The nearest enemy is Neutral; the farther one is Fire, weak to Frost.
    const near = spawnMonster(sim, 'hollowSoldier', 3, 2, 1);
    const far = spawnMonster(sim, 'hollowSoldier', 3, 4, 1);
    far.element = Element.Fire;
    for (const e of [near, far]) {
      e.aware = true;
      e.kit.moveSpeed = 0;
      e.kit.interval = 99;
    }
    arcanist.kit.interval = 99;
    sim.run(0.5);
    expect(arcanist.target).toBe(far);
  });

  it('is the innate of the job, known from the start', () => {
    const sim = new Sim(1);
    const arcanist = spawnMerc(sim, 'arcanist', 1, 0, 0);
    expect(JOBS.arcanist.innate.effect).toBe(ELEMENTAL_SENSE);
    expect(arcanist.passives.has('elementalSense')).toBe(true);
  });
});

describe('the Arcanist job', () => {
  it('has 4 spells in cast order, Elemental Sense and its look, and is not offered yet', () => {
    const def = JOBS.arcanist;
    expect(def.spells.map((s) => s.id)).toEqual(SPELLS);
    expect(def.spells).toEqual([FROST_NOVA, FIREBALL, FROST_SHARD, FIREBOLT]);
    expect(def.hireable).toBe(false);
    expect(def.role).toBe('striker');
    expect(Object.keys(def.icons).sort()).toEqual([...SPELLS].sort());
    expect(def.spells[0].cost).toBe(14);
    expect(def.spells[3].cooldown).toBe(2.5);
  });

  it('spawns with its staff and spells, and wins a headless fight with a party', () => {
    const sim = new Sim(5);
    const bearer = spawnBearer(sim, 0, 0);
    const arcanist = spawnMerc(sim, 'arcanist', 6, 1, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 6, 2, 0.5);
    const soldiers = [4, 5, 6].map((x) => spawnMonster(sim, 'hollowSoldier', 3, x, 0.5));
    for (const s of soldiers) {
      s.aware = true;
    }
    const cast = released(sim, arcanist);
    expect(arcanist.spells).toHaveLength(4);
    expect(arcanist.equipment.size).toBeGreaterThan(0);
    sim.run(90, () => !bearer.alive || sim.living(Side.Monster).length === 0);
    expect(sim.living(Side.Monster)).toHaveLength(0);
    expect(arcanist.alive).toBe(true);
    expect(vanguard.alive).toBe(true);
    // It used its spells, not only its staff.
    expect(cast.length).toBeGreaterThan(0);
  });
});

describe('Frost Nova', () => {
  it('rings the Arcanist: hits every enemy within 2.5 tiles for Frost, with Chill buildup', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const arcanist = spawnMerc(sim, 'arcanist', 8, 0, 0, toggles());
    const inside = [1, 2].map((x) => spawnMonster(sim, 'hollowSoldier', 3, x, 0));
    const outside = spawnMonster(sim, 'hollowSoldier', 3, 4.5, 0);
    for (const e of [...inside, outside]) {
      e.aware = true;
      e.kit.moveSpeed = 0;
      e.kit.interval = 99;
      e.derived.maxHp = 9999;
      e.hp = 9999;
    }
    arcanist.kit.interval = 99;
    const hits = record(sim, arcanist);
    expect(arcanist.startCast(FROST_NOVA, null)).toBe(true);
    sim.run(FROST_NOVA.windup + 0.05);
    const nova = hits.filter((h) => h.flags & DamageFlags.Skill);
    expect(nova.map((h) => h.target).sort(byId)).toEqual([...inside].sort(byId));
    for (const h of nova) {
      expect(h.element).toBe(Element.Frost);
      expect(h.kind).toBe(DamageKind.Magical);
      expect(h.ratio).toBe(novaRatio(1));
      expect(h.flags & DamageFlags.AoE).toBeTruthy();
    }
    expect(NOVA_RADIUS).toBe(2.5);
    expect(outside.hp).toBe(outside.derived.maxHp);
    // Chill buildup from the hit and from the spell
    for (const e of inside) {
      const chilled = e.statuses.has(CHILL.id) || (e.buildup.get(CHILL.id) ?? 0) > 0;
      expect(chilled).toBe(true);
    }
  });

  it('scales with rank, and is cast by the AI when an enemy reaches the Arcanist', () => {
    expect(novaRatio(5)).toBe(130);
    expect(novaChill(5)).toBe(45);
    const sim = new Sim(2);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const arcanist = spawnMerc(sim, 'arcanist', 8, 0, 0, toggles('frostNova'));
    const far = spawnMonster(sim, 'hollowSoldier', 3, 5, 0);
    far.aware = true;
    far.kit.moveSpeed = 0;
    const cast = released(sim, arcanist);
    sim.run(1);
    // Nothing is within 2.5 tiles, so it holds the spell.
    expect(cast).toEqual([]);
    const near = spawnMonster(sim, 'hollowSoldier', 3, 1.5, 0);
    near.aware = true;
    near.kit.moveSpeed = 0;
    setRank(arcanist, 'frostNova', 5);
    const hits = record(sim, arcanist);
    sim.run(1.5);
    expect(cast[0]).toBe('frostNova');
    expect(hits.find((h) => h.flags & DamageFlags.Skill)?.ratio).toBe(130);
  });
});

describe('Fireball', () => {
  it('hits the crowd around its target for Fire, and spares allies', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const arcanist = spawnMerc(sim, 'arcanist', 8, 0, 1, toggles());
    const ally = spawnMerc(sim, 'vanguard', 8, 4.5, 1, toggles());
    const pack = [
      spawnMonster(sim, 'hollowSoldier', 3, 4, 0),
      spawnMonster(sim, 'hollowSoldier', 3, 4.8, 0.6),
      spawnMonster(sim, 'hollowSoldier', 3, 4.2, -0.8),
    ];
    const away = spawnMonster(sim, 'hollowSoldier', 3, 8, 0);
    for (const e of [...pack, away]) {
      e.aware = true;
      e.kit.moveSpeed = 0;
      e.kit.interval = 99;
      e.derived.maxHp = 9999;
      e.hp = 9999;
    }
    ally.kit.interval = 99;
    arcanist.kit.interval = 99;
    const hits = record(sim, arcanist);
    expect(FIREBALL.wants(arcanist, pack[0], sim)).toBe(true);
    expect(arcanist.startCast(FIREBALL, pack[0])).toBe(true);
    sim.run(FIREBALL.windup + 0.05);
    const blast = hits.filter((h) => h.flags & DamageFlags.Skill);
    expect(blast.map((h) => h.target).sort(byId)).toEqual([...pack].sort(byId));
    for (const h of blast) {
      expect(h.element).toBe(Element.Fire);
      expect(h.ratio).toBe(fireballRatio(1));
      expect(h.flags & DamageFlags.FriendlyFire).toBe(0);
    }
    expect(away.hp).toBe(away.derived.maxHp);
    // None of its hits reached the party
    expect(hits.some((h) => h.target === ally || h.target === bearer)).toBe(false);
  });

  it('is saved for a crowd or an elite, not a lone enemy', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    expect(bearer.alive).toBe(true);
    const arcanist = spawnMerc(sim, 'arcanist', 8, 0, 1);
    const lone = spawnMonster(sim, 'hollowSoldier', 3, 4, 0);
    expect(FIREBALL.wants(arcanist, lone, sim)).toBe(false);
    const elite = spawnMonster(sim, 'hollowSoldier', 3, 4, 3, { elite: true });
    expect(FIREBALL.wants(arcanist, elite, sim)).toBe(true);
    spawnMonster(sim, 'hollowSoldier', 3, 4.5, 0.5);
    expect(FIREBALL.wants(arcanist, lone, sim)).toBe(true);
  });

  it('hurts allies in the blast only when a patched copy sets friendly fire', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const arcanist = spawnMerc(sim, 'arcanist', 8, 0, 1, toggles());
    const ally = spawnMerc(sim, 'vanguard', 8, 4.5, 1, toggles());
    const target = spawnMonster(sim, 'hollowSoldier', 3, 4, 0);
    target.aware = true;
    target.derived.maxHp = 9999;
    target.hp = 9999;
    arcanist.kit.interval = 99;
    target.kit.interval = 99;
    // As an elite upgrade (Inferno) patches the spell it casts
    const i = arcanist.skills.findIndex((s) => s.id === 'fireball');
    arcanist.skills[i] = { ...FIREBALL, friendlyFire: true };
    const hits = record(sim, arcanist);
    expect(arcanist.startCast(arcanist.skills[i], target)).toBe(true);
    sim.run(FIREBALL.windup + 0.05);
    const onAlly = hits.find((h) => h.target === ally);
    expect(onAlly).toBeDefined();
    expect((onAlly?.flags ?? 0) & DamageFlags.FriendlyFire).toBeTruthy();
  });
});

describe('Frost Shard', () => {
  it('is a Frost magic bolt at its rank', () => {
    const { sim, arcanist, target } = duel(Element.Fire);
    setRank(arcanist, 'frostShard', 4);
    const hits = record(sim, arcanist);
    expect(arcanist.startCast(FROST_SHARD, target)).toBe(true);
    sim.run(2);
    const bolt = hits.find((h) => h.flags & DamageFlags.Skill);
    expect(bolt?.element).toBe(Element.Frost);
    expect(bolt?.kind).toBe(DamageKind.Magical);
    expect(bolt?.ratio).toBe(shardRatio(4));
    expect(bolt?.flags).toBeTruthy();
    expect(bolt?.flags && bolt.flags & DamageFlags.Projectile).toBeTruthy();
    expect(FROST_SHARD.cost).toBe(7);
  });

  it('builds Chill from the Frost it deals', () => {
    const { sim, arcanist, target } = duel(Element.Neutral);
    // Frost Shard cast by hand at a neutral target
    expect(arcanist.startCast(FROST_SHARD, target)).toBe(true);
    sim.run(2);
    const chilled = target.statuses.has(CHILL.id) || (target.buildup.get(CHILL.id) ?? 0) > 0;
    expect(chilled).toBe(true);
  });
});

describe('Firebolt', () => {
  it('is a Fire magic bolt with Burn buildup that grows with rank', () => {
    const { sim, arcanist, target } = duel(Element.Neutral);
    setRank(arcanist, 'firebolt', 6);
    const hits = record(sim, arcanist);
    expect(fireboltBurn(6)).toBe(32);
    expect(arcanist.startCast(FIREBOLT, target)).toBe(true);
    sim.run(2);
    const bolt = hits.find((h) => h.flags & DamageFlags.Skill);
    expect(bolt?.element).toBe(Element.Fire);
    expect(bolt?.ratio).toBe(fireboltRatio(6));
    // The element's own buildup plus the bolt's 32
    expect(target.statuses.has(BURN.id) || (target.buildup.get(BURN.id) ?? 0) >= 32).toBe(true);
  });

  it('is the filler: the AI casts it on a lone enemy when the bigger spells do not apply', () => {
    const { sim, arcanist } = duel(Element.Neutral);
    arcanist.toggles = toggles('frostNova', 'fireball', 'frostShard', 'firebolt');
    const cast = released(sim, arcanist);
    sim.run(6);
    expect(cast.every((id) => id === 'firebolt')).toBe(true);
    expect(cast.length).toBeGreaterThanOrEqual(2);
  });
});

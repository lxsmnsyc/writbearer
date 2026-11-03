import { describe, expect, it, vi } from 'vitest';
import { EventPriority } from '../../src/core/event-emitter';
import { JOBS } from '../../src/content/jobs';
import { HAMSTRUNG, hamstrungAt } from '../../src/content/jobs/sellsword/spells';
import SELLSWORD_UPGRADES, {
  BRIBED,
  BRIBE_COST,
  CRIPPLE_TIME,
  HABIT_SPEED,
  KNOCK_DISTANCE,
  LOW_BLOW_CRIT,
  PLAYING_DEAD,
  PLAY_DEAD_HEALTH,
  PLAY_DEAD_TIME,
  POCKET_CHANGE,
  SALT,
  VETERAN_MAX,
  bribeGold,
  countWeaponUse,
  habitOf,
  heldKind,
  phasesSurvived,
  survivePhase,
} from '../../src/content/jobs/sellsword/upgrades';
import { type MonsterKind, spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { rankOf } from '../../src/content/skills';
import ObjectiveRun from '../../src/game/objective';
import { type MercSave, loadMerc, saveMerc } from '../../src/game/save';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateStage } from '../../src/gen/stage';
import { updateWarnings } from '../../src/sim/warning';
import { rollDrops } from '../../src/gen/loot';
import RNG from '../../src/core/rng';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { type Upgrade, isBuilt } from '../../src/sim/builds';
import { SimEvents } from '../../src/sim/events';
import Sim, { strike } from '../../src/sim/sim';
import { type Skill, SkillMode } from '../../src/sim/skill';
import { BLIND, ROOTED, SHIELD_WALL, TAUNTED } from '../../src/sim/statuses';
import { canTarget } from '../../src/sim/targeting';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Rank,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { withUpgrade } from '../support/build';

// The Sellsword's 12 elite upgrades.

const SPELLS = ['rush', 'pocketSand', 'hamstring', 'cleave'];

const upgrade = (id: string): Upgrade => {
  const found = SELLSWORD_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// Every blow lands.
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

// A still Sellsword with an upgrade, next to the bearer at the origin
function sellswordWith(id: string | null, level = 10): { sim: Sim; sword: Unit } {
  const sim = new Sim(5);
  alwaysHit(sim);
  spawnBearer(sim, 0, 0);
  const sword = spawnMerc(sim, 'sellsword', level, 1, 0, quiet());
  sword.kit.interval = 0;
  sword.kit.moveSpeed = 0;
  sword.mana = sword.derived.maxMana;
  if (id) {
    withUpgrade(sword, upgrade(id));
  }
  return { sim, sword };
}

// A still, awake, tough monster
function foe(sim: Sim, x: number, z: number, kind: MonsterKind = 'hollowSoldier'): Unit {
  const m = spawnMonster(sim, kind, 3, x, z);
  m.aware = true;
  m.kit.moveSpeed = 0;
  m.kit.interval = 99;
  m.derived.maxHp = 100000;
  m.hp = 100000;
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

// Releases a spell through the event, as a cast does
function cast(sim: Sim, u: Unit, id: string, target: Unit | null): void {
  sim.emit(SimEvents.UnitSkillRelease, {
    id: 'UnitSkillRelease',
    disabled: false,
    source: u,
    skill: spell(u, id),
    target,
  });
}

const lost = (u: Unit): number => u.derived.maxHp - u.hp;

describe('the Sellsword upgrades', () => {
  it('has 12, three per spell, each with a patch or an effect', () => {
    const { upgrades, spells } = JOBS.sellsword;
    expect(upgrades).toBe(SELLSWORD_UPGRADES);
    expect(upgrades).toHaveLength(12);
    for (const s of spells) {
      expect(upgrades.filter((u) => u.spell === s.id)).toHaveLength(3);
    }
    for (const u of upgrades) {
      expect(isBuilt(u), u.id).toBe(true);
      expect(u.describe(5).length).toBeGreaterThan(10);
    }
  });
});

describe('Rush upgrades', () => {
  it('Shield Rush taunts the target after it arrives', () => {
    const { sim, sword } = sellswordWith('shieldRush');
    const enemy = foe(sim, 3, 0);
    enemy.target = sim.bearer;
    const rush = spell(sword, 'rush');
    expect(rush.aim?.(sword, sim)).toBe(enemy);
    rush.release(sword, enemy, sim);
    expect(sword.distanceTo(enemy)).toBeLessThanOrEqual(sword.kit.reach);
    const taunt = enemy.statuses.get(TAUNTED.id);
    expect(taunt?.source).toBe(sword);
    expect(taunt?.remaining).toBeCloseTo(3);
  });

  it('Chain Rush rushes the next threat, free, when the target dies within 2 seconds', () => {
    const { sim, sword } = sellswordWith('chainRush');
    const first = foe(sim, 3, 0);
    const second = foe(sim, -3, 0);
    first.target = sim.bearer;
    second.target = sim.bearer;
    first.hp = 1;
    const mana = sword.mana;
    cast(sim, sword, 'rush', first);
    expect(first.alive).toBe(false);
    expect(lost(second)).toBeGreaterThan(0);
    expect(sword.distanceTo(second)).toBeLessThanOrEqual(sword.kit.reach);
    expect(sword.mana).toBe(mana);
  });

  it('Chain Rush does nothing when the target dies later', () => {
    const { sim, sword } = sellswordWith('chainRush');
    const first = foe(sim, 3, 0);
    const second = foe(sim, -3, 0);
    first.target = sim.bearer;
    second.target = sim.bearer;
    cast(sim, sword, 'rush', first);
    sim.time += 2.5;
    strike(sword, first, { fixed: 1e6, kind: DamageKind.True });
    expect(first.alive).toBe(false);
    expect(lost(second)).toBe(0);
  });

  it('Knock Aside pushes the target 2 tiles away from the bearer', () => {
    const { sim, sword } = sellswordWith('knockAside');
    const enemy = foe(sim, 2, 0);
    enemy.target = sim.bearer;
    spell(sword, 'rush').release(sword, enemy, sim);
    expect(enemy.x).toBeCloseTo(2 + KNOCK_DISTANCE);
    expect(enemy.z).toBeCloseTo(0);
    expect(lost(enemy)).toBeGreaterThan(0);
  });
});

describe('Pocket Sand upgrades', () => {
  it('Bribe pays gold and 12 mana, and a Human enemy walks off and is gone, dropping nothing', () => {
    const { sim, sword } = sellswordWith('bribe');
    sim.purse = { gold: 500 };
    const human = foe(sim, 2, 0, 'penitent');
    human.kit.moveSpeed = 2;
    const bribe = spell(sword, 'pocketSand');
    expect(bribe.cost).toBe(BRIBE_COST);
    expect(bribe.aim?.(sword, sim)).toBe(human);
    let deaths = 0;
    sim.on(SimEvents.UnitDies, EventPriority.Post, () => {
      deaths++;
    });
    const price = bribeGold(human);
    bribe.release(sword, human, sim);
    expect(sim.purse.gold).toBe(500 - price);
    expect(human.statuses.has(BRIBED.id)).toBe(true);
    expect(canTarget(sword, human)).toBe(false);
    expect(canTarget(human, sword)).toBe(false);
    const x = human.x;
    sim.run(1);
    expect(human.x).toBeGreaterThan(x);
    sim.run(2.5);
    expect(sim.units.has(human)).toBe(false);
    expect(human.alive).toBe(false);
    expect(human.cast).toBeNull();
    expect(deaths).toBe(0);
  });

  it('Bribe refuses the undead, elites, and a party without the gold', () => {
    const { sim, sword } = sellswordWith('bribe');
    const bribe = spell(sword, 'pocketSand');
    const undead = foe(sim, 2, 0);
    sim.purse = { gold: 500 };
    expect(bribe.aim?.(sword, sim)).toBeNull();
    const human = foe(sim, 2, 1, 'penitent');
    sim.purse = { gold: bribeGold(human) - 1 };
    expect(bribe.aim?.(sword, sim)).toBeNull();
    sim.purse = null;
    expect(bribe.aim?.(sword, sim)).toBeNull();
    sim.purse = { gold: 500 };
    human.rank = Rank.Elite;
    expect(bribe.aim?.(sword, sim)).toBeNull();
    bribe.release(sword, human, sim);
    expect(sim.purse.gold).toBe(500);
    expect(undead.statuses.has(BRIBED.id)).toBe(false);
  });

  it('Play Dead lies still once an area, hidden from monsters, then gets up', () => {
    const { sim, sword } = sellswordWith('playDead');
    const enemy = foe(sim, 2, 0);
    strike(enemy, sword, { fixed: 1e6, kind: DamageKind.True });
    expect(sword.alive).toBe(true);
    expect(sword.statuses.has(PLAYING_DEAD.id)).toBe(true);
    expect(sword.disabled).toBe(true);
    expect(canTarget(enemy, sword)).toBe(false);
    // The sand it throws
    expect((enemy.buildup.get(BLIND.id) ?? 0) > 0 || enemy.statuses.has(BLIND.id)).toBe(true);
    sim.run(PLAY_DEAD_TIME + 0.1);
    expect(sword.statuses.has(PLAYING_DEAD.id)).toBe(false);
    expect(sword.hp).toBeGreaterThanOrEqual(
      Math.floor((sword.derived.maxHp * PLAY_DEAD_HEALTH) / 100),
    );
    expect(canTarget(enemy, sword)).toBe(true);
    // A second time in the same area it dies.
    strike(enemy, sword, { fixed: 1e6, kind: DamageKind.True });
    expect(sword.alive).toBe(false);
  });

  it('Play Dead works again in a new area', () => {
    const { sim, sword } = sellswordWith('playDead');
    const enemy = foe(sim, 2, 0);
    strike(enemy, sword, { fixed: 1e6, kind: DamageKind.True });
    sim.run(PLAY_DEAD_TIME + 0.1);
    sim.area++;
    strike(enemy, sword, { fixed: 1e6, kind: DamageKind.True });
    expect(sword.alive).toBe(true);
    expect(sword.statuses.has(PLAYING_DEAD.id)).toBe(true);
  });

  it('Salt the Wound makes blinded enemies take 15% more from every merc', () => {
    const { sim } = sellswordWith('saltTheWound');
    const other = spawnMerc(sim, 'vanguard', 10, -1, 0, quiet());
    const blind = foe(sim, 2, 0);
    const seeing = foe(sim, 2, 2);
    blind.addStatus(BLIND, other);
    const before = new Map<Unit, number>();
    const after = new Map<Unit, number>();
    sim.on(SimEvents.UnitDamage, DamagePriority.SkillFlat, (e) => {
      before.set(e.target, e.value);
    });
    sim.on(SimEvents.UnitDamage, DamagePriority.Amplify, (e) => {
      after.set(e.target, e.value);
    });
    strike(other, blind, {});
    strike(other, seeing, {});
    // Other amplifiers apply to both alike.
    const share = (u: Unit): number => after.get(u)! / before.get(u)!;
    expect(share(blind) / share(seeing)).toBeCloseTo(SALT);
  });
});

describe('Hamstring upgrades', () => {
  it('Low Blow adds crit rate against blinded or slowed targets', () => {
    const { sim, sword } = sellswordWith('lowBlow');
    const plain = foe(sim, 2, 0);
    const blind = foe(sim, 2, 1);
    const slowed = foe(sim, 2, -1);
    blind.addStatus(BLIND, sword);
    slowed.addStatus(HAMSTRUNG, sword);
    const crit = new Map<Unit, number>();
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, (e) => {
      crit.set(e.target, e.critRate);
    });
    for (const t of [plain, blind, slowed]) {
      strike(sword, t, {});
    }
    expect(crit.get(blind)! - crit.get(plain)!).toBe(LOW_BLOW_CRIT);
    expect(crit.get(slowed)! - crit.get(plain)!).toBe(LOW_BLOW_CRIT);
  });

  it('Cutpurse steals a buff on a hit and keeps it', () => {
    const { sim, sword } = sellswordWith('cutpurse');
    const enemy = foe(sim, 2, 0);
    enemy.addStatus(SHIELD_WALL, enemy);
    vi.spyOn(sim.rng, 'chance').mockReturnValue(true);
    strike(sword, enemy, {});
    expect(enemy.statuses.has(SHIELD_WALL.id)).toBe(false);
    expect(sword.statuses.has(SHIELD_WALL.id)).toBe(true);
  });

  it('Cutpurse fails 85% of the time', () => {
    const { sim, sword } = sellswordWith('cutpurse');
    const enemy = foe(sim, 2, 0);
    enemy.addStatus(SHIELD_WALL, enemy);
    vi.spyOn(sim.rng, 'chance').mockReturnValue(false);
    strike(sword, enemy, {});
    expect(enemy.statuses.has(SHIELD_WALL.id)).toBe(true);
  });

  it('Cripple roots a target that was already slowed', () => {
    const { sim, sword } = sellswordWith('cripple');
    const fresh = foe(sim, 2, 0);
    const slowed = foe(sim, 2, 0.5);
    slowed.addStatus(hamstrungAt(1), sword);
    const hamstring = spell(sword, 'hamstring');
    hamstring.release(sword, fresh, sim);
    expect(fresh.statuses.has(HAMSTRUNG.id)).toBe(true);
    expect(fresh.statuses.has(ROOTED.id)).toBe(false);
    // Wanted again on a hamstrung target, until it is rooted
    expect(hamstring.wants(sword, fresh, sim)).toBe(true);
    hamstring.release(sword, slowed, sim);
    expect(slowed.statuses.get(ROOTED.id)?.remaining).toBeCloseTo(CRIPPLE_TIME);
    expect(hamstring.wants(sword, slowed, sim)).toBe(false);
  });
});

describe('Cleave upgrades', () => {
  it('Weapon Habit counts fighting time by weapon kind', () => {
    const { sim, sword } = sellswordWith(null);
    const enemy = foe(sim, 2, 0);
    expect(heldKind(sword)).toBe('sword');
    expect(habitOf(sword)).toBeNull();
    countWeaponUse(sim, 1);
    expect(habitOf(sword)).toBeNull();
    sword.target = enemy;
    countWeaponUse(sim, 1);
    expect(habitOf(sword)).toBe('sword');
    sword.tally.set('habit.mace', 5);
    expect(habitOf(sword)).toBe('mace');
  });

  it('Weapon Habit attacks faster with the habit weapon only', () => {
    const swing = (habit: string): number => {
      const { sim, sword } = sellswordWith('weaponHabit');
      const enemy = foe(sim, 2, 0);
      sword.tally.set(`habit.${habit}`, 10);
      sword.kit.interval = 1;
      sword.startAttack(enemy);
      sim.tick();
      return sword.cooldown;
    };
    const plain = swing('mace');
    expect(swing('sword')).toBeCloseTo(plain / HABIT_SPEED);
  });

  it('Veteran of Many Wars adds a Cleave rank per phase survived, up to +3', () => {
    const { sim, sword } = sellswordWith('veteranOfManyWars');
    const base = rankOf(sword, 'cleave');
    survivePhase(sim);
    expect(phasesSurvived(sword)).toBe(1);
    expect(rankOf(sword, 'cleave')).toBe(base + 1);
    for (let i = 0; i < 5; i++) {
      survivePhase(sim);
    }
    expect(rankOf(sword, 'cleave')).toBe(base + VETERAN_MAX);
    expect(rankOf(sword, 'hamstring')).toBe(sword.skillRank('hamstring'));
    // The dead survive nothing.
    sword.alive = false;
    survivePhase(sim);
    expect(phasesSurvived(sword)).toBe(6);
  });

  it('keeps the run-long counts in a save', () => {
    const { sim, sword } = sellswordWith('veteranOfManyWars');
    survivePhase(sim);
    sword.tally.set('habit.sword', 12);
    const saved = saveMerc(sword);
    expect(saved.tally).toEqual([
      ['phases', 1],
      ['habit.sword', 12],
    ]);
    const back = loadMerc(new Sim(1), saved, 0, 0);
    expect([...back.tally]).toEqual(saved.tally);
    expect(phasesSurvived(back)).toBe(1);
    expect(habitOf(back)).toBe('sword');
    expect(rankOf(back, 'cleave')).toBe(rankOf(sword, 'cleave'));
  });

  it('writes no counts for a merc without any, and loads a save from before them', () => {
    const { sword } = sellswordWith('veteranOfManyWars');
    const saved = saveMerc(sword);
    expect('tally' in saved).toBe(false);
    const old: MercSave = { ...saved };
    delete old.tally;
    const back = loadMerc(new Sim(1), old, 0, 0);
    expect(back.tally.size).toBe(0);
    expect(phasesSurvived(back)).toBe(0);
    expect(habitOf(back)).toBeNull();
    expect(rankOf(back, 'cleave')).toBe(rankOf(sword, 'cleave'));
  });

  it('Pocket Change marks Cleave kills to drop 50% more gold', () => {
    const { sim, sword } = sellswordWith('pocketChange');
    const cleaved = foe(sim, 2, 0);
    const cut = foe(sim, 2, 0.3);
    cleaved.hp = 1;
    cut.hp = 1;
    sword.x = 1.2;
    spell(sword, 'cleave').release(sword, cleaved, sim);
    expect(cleaved.alive).toBe(false);
    expect(cleaved.bounty).toBe(POCKET_CHANGE);
    // A kill by any other blow pays as before.
    const other = foe(sim, 2, -0.3);
    other.hp = 1;
    strike(sword, other, { flags: DamageFlags.BasicAttack });
    expect(other.alive).toBe(false);
    expect(other.bounty).toBe(1);
    // The other enemy in the arc counts as a Cleave kill too.
    expect(cut.alive).toBe(false);
    expect(cut.bounty).toBe(POCKET_CHANGE);
  });

  it('a bounty multiplies the gold a kill drops, with the same draws', () => {
    const gold = (bounty: number): number => {
      const rng = new RNG(9);
      let total = 0;
      for (let i = 0; i < 50; i++) {
        for (const item of rollDrops(rng, 5, Rank.Normal, bounty)) {
          if (item.base.id === 'gold') {
            total += item.quantity;
          }
        }
      }
      return total;
    };
    const plain = gold(1);
    expect(plain).toBeGreaterThan(0);
    expect(gold(POCKET_CHANGE)).toBeCloseTo(plain * POCKET_CHANGE, -1);
  });

  it('mercs other than a Sellsword keep no counts', () => {
    const { sim } = sellswordWith(null);
    const other = spawnMerc(sim, 'vanguard', 10, -1, 0, quiet());
    other.target = foe(sim, 2, 0);
    survivePhase(sim);
    countWeaponUse(sim, 1);
    expect(other.tally.size).toBe(0);
    expect(sim.living(Side.Party)).toContain(other);
  });
});

describe('a bribed wave', () => {
  it('lets an Ambush finish once its last units are bribed away', () => {
    const s = generateStage(new RNG(6), 12, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'ambush',
    });
    const sim = new Sim(1);
    enterStage(sim, s);
    const bearer = spawnParty(sim, s, []);
    const run = new ObjectiveRun('ambush', s);
    const step = (seconds: number): void => {
      for (let t = 0; t < seconds; t += 0.05) {
        run.update(sim, 0.05, 14);
        updateWarnings(sim, 0.05);
      }
    };
    step(2);
    const fire = s.rest!;
    bearer.x = fire.x - 3;
    bearer.z = fire.z;
    step(2);
    const came = sim.living(Side.Monster);
    expect(came.length).toBeGreaterThan(0);
    let deaths = 0;
    sim.on(SimEvents.UnitDies, EventPriority.Post, () => {
      deaths++;
    });
    for (const m of came) {
      m.addStatus(BRIBED, bearer);
      m.tickStatuses(BRIBED.duration + 0.1);
    }
    expect(sim.living(Side.Monster)).toHaveLength(0);
    step(0.05);
    expect(run.done).toBe(true);
    expect(deaths).toBe(0);
  });
});

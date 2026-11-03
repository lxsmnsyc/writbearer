import { type Upgrade, applyUpgrade, cannotRaise, raise, upgradeById } from '../../src/sim/builds';
import type { Passive, Skill } from '../../src/sim/skill';
import type Unit from '../../src/sim/unit';

/**
 * Spends every shard as a player building a merc might: raises its spells
 * in cast order, one rank each in turn, until it can raise none.
 */
export default function spendAll(m: Unit): void {
  for (let n = 0; n < 100 && m.shards > 0; n++) {
    let raised = false;
    for (const spell of m.spells) {
      if (cannotRaise(m, spell.id) === null) {
        raise(m, spell.id);
        raised = true;
      }
    }
    if (!raised) {
      return;
    }
  }
}

/** Sets a spell's rank, past the cap and without shards, for a test. */
export function setRank(m: Unit, spell: string, rank: number): void {
  m.skillRanks.set(spell, rank);
}

/** Gives a spell an elite upgrade, failing the test if it cannot. */
export function withUpgrade(m: Unit, upgrade: Upgrade): void {
  if (upgradeById(upgrade.id) !== upgrade) {
    throw new Error(`${upgrade.id} is not one of a job's upgrades.`);
  }
  const why = applyUpgrade(m, upgrade);
  if (why) {
    throw new Error(why);
  }
}

/**
 * Gives a merc a skill or a passive at a rank, outside the build model: for
 * tests of skill code that is waiting to become an elite upgrade.
 */
export function teach(m: Unit, thing: Skill | Passive, rank = 1): void {
  m.skillRanks.set(thing.id, rank);
  if ('setup' in thing) {
    m.passives.get(thing.id)?.stop();
    const life = thing.setup(m, rank);
    m.passives.set(thing.id, life);
    life.start();
  } else if (!m.skills.includes(thing)) {
    m.skills.push(thing);
  }
}

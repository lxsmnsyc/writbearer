import { cannotLearn, learn, treeFor } from '../../src/content/trees';
import {
  type Upgrade,
  applyUpgrade,
  giveSpells,
  registerBuild,
  upgradeById,
} from '../../src/sim/builds';
import type { Skill } from '../../src/sim/skill';
import type Unit from '../../src/sim/unit';

/**
 * Spends every skill point as a player building a merc might: ranks up the
 * skills it has before opening new ones, and opens them in tree order.
 */
export default function spendAll(m: Unit): void {
  for (let n = 0; n < 100 && m.skillPoints > 0; n++) {
    const open = treeFor(m).flatMap((branch) =>
      branch.nodes
        .filter((node) => cannotLearn(m, branch, node) === null)
        .map((node) => ({ branch, node })),
    );
    const rank = (id: string): number => m.skillRanks.get(id) ?? 0;
    const pick = open.sort((a, b) => rank(b.node.id) - rank(a.node.id)).at(0);
    if (!pick) {
      return;
    }
    learn(m, pick.branch, pick.node);
  }
}

/**
 * Puts a merc on the build model with these spells, as job-registry will,
 * and registers them with the upgrades as its kind's build. Call
 * `unregisterBuild(m.kind)` after the test.
 */
export function withSpells(m: Unit, spells: readonly Skill[], upgrades: Upgrade[] = []): Unit {
  registerBuild(m.kind, { spells: [...spells], upgrades });
  giveSpells(m, spells);
  return m;
}

/** Sets a spell's rank, past the cap and without shards, for a test. */
export function setRank(m: Unit, spell: string, rank: number): void {
  m.skillRanks.set(spell, rank);
}

/** Gives a spell an elite upgrade, failing the test if it cannot. */
export function withUpgrade(m: Unit, upgrade: Upgrade): void {
  if (upgradeById(upgrade.id) !== upgrade) {
    throw new Error(`${upgrade.id} is not in a registered build.`);
  }
  const why = applyUpgrade(m, upgrade);
  if (why) {
    throw new Error(why);
  }
}

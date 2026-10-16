import { cannotLearn, learn, treeFor } from '../../src/content/trees';
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

import type { Passive, Skill } from '../sim/skill';
import type Unit from '../sim/unit';
import {
  EAGLE_EYE,
  SHARED_BURDEN,
  STATIC,
  SUNDER,
  VOW,
  eagleEyeText,
  sharedBurdenText,
  staticText,
  sunderText,
  vowText,
} from './passives';
import {
  AIMED_SHOT,
  CHALLENGE,
  CHARGED_ARROW,
  CLEANSE,
  CRUSH,
  HEAL,
  INTERCEPT,
  PIERCING_ARROW,
  PIN_DOWN,
  RENEW,
  RESURRECTION,
  SHIELD_BASH,
  SMITE,
  SNARE,
} from './skills';
import {
  BANNER,
  BASTION,
  EARTHSHAKER,
  FAULT_LINE,
  IMMOVABLE,
  LAST_LINE,
  RAMPART,
  SHIELD_WALL_SKILL,
  bastionText,
  earthshakerText,
  immovableText,
  lastLineText,
} from './vanguard';
import {
  ARC_VOLLEY,
  BAIT,
  KILLING_GROUND,
  KILLSHOT,
  LIGHTNING_ROD,
  REARGUARD,
  SPIKE_FIELD,
  THUNDERHEAD,
  killingGroundText,
  killshotText,
  rearguardText,
  thunderheadText,
} from './ranger';
import {
  AEGIS,
  CONSECRATION,
  HOLY_LIGHT,
  MARTYR,
  PURGE,
  SACRED_GROUND,
  TURN_UNDEAD,
  VEIL,
  WALL_OF_FAITH,
  WARD,
  aegisText,
  holyLightText,
  martyrText,
  purgeText,
} from './cleric';

/**
 * One skill in a tree. Nodes without a `skill` or `passive` are designed but
 * not in the game yet, and cannot be learned.
 */
export interface TreeNode {
  id: string;
  name: string;
  // 1 to 5. The fifth is the capstone.
  tier: number;
  passive: boolean;
  // The design's one-line summary, shown for nodes not in the game yet
  summary: string;
  skill?: Skill;
  effect?: Passive;
  // What a passive does at a rank. Active skills describe themselves.
  describe?: (rank: number) => string;
}

export interface Branch {
  name: string;
  summary: string;
  nodes: TreeNode[];
}

/** The merc level each tier unlocks at, as Diablo 2. */
export const TIER_LEVEL = [1, 4, 8, 12, 16];
const MAX_RANK = 5;
const CAPSTONE_RANK = 1;

export const maxRank = (node: TreeNode): number => (node.tier === 5 ? CAPSTONE_RANK : MAX_RANK);

const active = (tier: number, skill: Skill, summary: string): TreeNode => ({
  id: skill.id,
  name: skill.name,
  tier,
  passive: false,
  summary,
  skill,
});

const passive = (
  tier: number,
  name: string,
  effect: Passive,
  describe: (rank: number) => string,
  summary: string,
): TreeNode => ({ id: effect.id, name, tier, passive: true, summary, effect, describe });

/** Each job's three branches, from the skill-tree design. */
export const TREES: Record<string, Branch[]> = {
  Vanguard: [
    {
      name: 'Bulwark',
      summary: 'Shields and taunts.',
      nodes: [
        active(1, CHALLENGE, 'Taunts every enemy within 3 tiles.'),
        active(2, SHIELD_WALL_SKILL, 'Blocks every hit from the front for a few seconds.'),
        passive(3, 'Bastion', BASTION, bastionText, 'Allies behind it take less ranged damage.'),
        active(4, RAMPART, 'Plants its shield as a short wall that stops arrows.'),
        passive(
          5,
          'Immovable',
          IMMOVABLE,
          immovableText,
          'Cannot be stunned or feared during Shield Wall or while holding.',
        ),
      ],
    },
    {
      name: 'Breaker',
      summary: 'Breaks armor and enemies.',
      nodes: [
        passive(1, 'Sunder', SUNDER, sunderText, 'Melee hits lower the target’s armor, stacking.'),
        active(2, CRUSH, 'A heavy hit with Earth buildup.'),
        active(3, SHIELD_BASH, 'Stun buildup. Interrupts casts.'),
        active(4, FAULT_LINE, 'A shockwave in a line that adds Earth buildup.'),
        passive(
          5,
          'Earthshaker',
          EARTHSHAKER,
          earthshakerText,
          'A Petrified enemy spreads Earth buildup to its neighbors.',
        ),
      ],
    },
    {
      name: 'Oathkeeper',
      summary: 'Guards the bearer.',
      nodes: [
        passive(1, 'Vow', VOW, vowText, '+armor while near the bearer.'),
        active(2, INTERCEPT, 'Dashes between the bearer and the nearest threat.'),
        passive(
          3,
          'Shared Burden',
          SHARED_BURDEN,
          sharedBurdenText,
          'Takes a share of the damage the bearer would take.',
        ),
        active(4, BANNER, 'Plants a banner. Allies near it take heart and resist fear.'),
        passive(
          5,
          'Last Line',
          LAST_LINE,
          lastLineText,
          'When the bearer drops below 30%, taunts everything near it.',
        ),
      ],
    },
  ],
  Ranger: [
    {
      name: 'Hawkeye',
      summary: 'Picks off priority targets.',
      nodes: [
        active(1, AIMED_SHOT, 'A long windup for a high damage shot.'),
        active(2, PIN_DOWN, 'Pins an enemy in place. Grounds flyers.'),
        passive(3, 'Eagle Eye', EAGLE_EYE, eagleEyeText, '+range and +accuracy.'),
        active(4, PIERCING_ARROW, 'Hits every enemy in a line.'),
        passive(
          5,
          'Killshot',
          KILLSHOT,
          killshotText,
          'The first shot at an unaware enemy is a double-damage crit.',
        ),
      ],
    },
    {
      name: 'Trapper',
      summary: 'Guards the path behind the bearer.',
      nodes: [
        active(1, SNARE, 'A trap that roots.'),
        passive(
          2,
          'Rearguard',
          REARGUARD,
          rearguardText,
          'Sets traps where the bearer just walked.',
        ),
        active(3, BAIT, 'A decoy that draws monsters for a few seconds.'),
        active(4, SPIKE_FIELD, 'An area that slows and adds bleed.'),
        passive(
          5,
          'Killing Ground',
          KILLING_GROUND,
          killingGroundText,
          'A shouted Hold rings the spot with traps.',
        ),
      ],
    },
    {
      name: 'Stormcaller',
      summary: 'Arrows charged with Storm.',
      nodes: [
        active(1, CHARGED_ARROW, 'A Storm arrow that chains to 1 more target.'),
        passive(2, 'Static', STATIC, staticText, '+Storm buildup.'),
        active(3, ARC_VOLLEY, 'Several arrows. Each one chains.'),
        active(4, LIGHTNING_ROD, 'A rod that makes a Storm field.'),
        passive(
          5,
          'Thunderhead',
          THUNDERHEAD,
          thunderheadText,
          'A Shock leaps to every other charged enemy near it.',
        ),
      ],
    },
  ],
  Cleric: [
    {
      name: 'Mercy',
      summary: 'Healing and resurrection.',
      nodes: [
        active(1, HEAL, 'Heals one ally or the bearer.'),
        active(2, RENEW, 'Heals over time.'),
        active(3, CLEANSE, 'Removes harmful statuses and clears buildup.'),
        active(4, RESURRECTION, 'Brings a dead merc back. A long windup.'),
        passive(5, 'Martyr', MARTYR, martyrText, 'When the Cleric dies, the dead around it rise.'),
      ],
    },
    {
      name: 'Sanctuary',
      summary: 'Barriers.',
      nodes: [
        active(1, WARD, 'A pool that absorbs magical damage.'),
        active(2, SACRED_GROUND, 'An area that heals over time.'),
        active(3, WALL_OF_FAITH, 'A spot that stops a number of melee hits.'),
        active(4, VEIL, 'An area that stops ranged physical hits.'),
        passive(5, 'Aegis', AEGIS, aegisText, 'The bearer’s Ward refills outside a fight.'),
      ],
    },
    {
      name: 'Inquisition',
      summary: 'Fights the Occult and the dead.',
      nodes: [
        active(1, SMITE, 'Radiant damage.'),
        passive(2, 'Holy Light', HOLY_LIGHT, holyLightText, '+Sear buildup.'),
        active(3, TURN_UNDEAD, 'A chance to destroy a non-boss Undead at once.'),
        active(4, CONSECRATION, 'A Radiant field that burns enemies on it.'),
        passive(
          5,
          'Purge',
          PURGE,
          purgeText,
          'Occult enemies take 25% more damage from the party.',
        ),
      ],
    },
  ],
};

/** Why a merc cannot learn a rank of a node now, or null if it can. */
export function cannotLearn(unit: Unit, branch: Branch, node: TreeNode): string | null {
  if (!node.skill && !node.effect) {
    return 'Not in the game yet.';
  }
  const rank = unit.skillRanks.get(node.id) ?? 0;
  if (rank >= maxRank(node)) {
    return 'Mastered.';
  }
  if (unit.level < TIER_LEVEL[node.tier - 1]) {
    return `Needs level ${TIER_LEVEL[node.tier - 1]}.`;
  }
  const before = node.tier > 1 ? branch.nodes.at(node.tier - 2) : undefined;
  if (before && (unit.skillRanks.get(before.id) ?? 0) < 1) {
    return `Needs ${before.name} first.`;
  }
  if (unit.skillPoints <= 0) {
    return 'No skill points.';
  }
  return null;
}

/** Spends a skill point on a node. Returns why it failed, or null. */
export function learn(unit: Unit, branch: Branch, node: TreeNode): string | null {
  const why = cannotLearn(unit, branch, node);
  if (why) {
    return why;
  }
  const rank = (unit.skillRanks.get(node.id) ?? 0) + 1;
  unit.skillRanks.set(node.id, rank);
  unit.skillPoints--;
  if (node.skill && rank === 1) {
    unit.skills.push(node.skill);
  }
  if (node.effect) {
    // The passive is set up again at its new rank.
    unit.passives.get(node.id)?.stop();
    const life = node.effect.setup(unit, rank);
    unit.passives.set(node.id, life);
    life.start();
  }
  return null;
}

/** A merc's tree, by its job. Empty for jobs without one yet. */
export const treeFor = (unit: Unit): Branch[] => TREES[unit.job.name] ?? [];

/** Finds a node in a merc's tree, with its branch. */
export function findNode(unit: Unit, id: string): { branch: Branch; node: TreeNode } | null {
  for (const branch of treeFor(unit)) {
    const node = branch.nodes.find((n) => n.id === id);
    if (node) {
      return { branch, node };
    }
  }
  return null;
}

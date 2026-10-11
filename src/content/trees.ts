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

const planned = (
  tier: number,
  id: string,
  name: string,
  kind: 'A' | 'P',
  summary: string,
): TreeNode => ({
  id,
  name,
  tier,
  passive: kind === 'P',
  summary,
});

/** Each job's three branches, from the skill-tree design. */
export const TREES: Record<string, Branch[]> = {
  Vanguard: [
    {
      name: 'Bulwark',
      summary: 'Shields and taunts.',
      nodes: [
        active(1, CHALLENGE, 'Taunts every enemy within 3 tiles.'),
        planned(
          2,
          'shieldWall',
          'Shield Wall',
          'A',
          'Blocks every hit from the front for a few seconds, standing still.',
        ),
        planned(3, 'bastion', 'Bastion', 'P', 'Allies behind it take less ranged damage.'),
        planned(
          4,
          'rampart',
          'Rampart',
          'A',
          'Plants its shield as a short wall that stops ranged hits.',
        ),
        planned(
          5,
          'immovable',
          'Immovable',
          'P',
          'Cannot be knocked back, stunned or feared while holding.',
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
        planned(
          4,
          'faultLine',
          'Fault Line',
          'A',
          'A shockwave in a line that adds Earth buildup.',
        ),
        planned(
          5,
          'earthshaker',
          'Earthshaker',
          'P',
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
        planned(4, 'banner', 'Banner', 'A', 'Plants a banner. Allies near it resist fear.'),
        planned(
          5,
          'lastLine',
          'Last Line',
          'P',
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
        planned(
          5,
          'killshot',
          'Killshot',
          'P',
          'The first shot at an unaware enemy is a double-damage crit.',
        ),
      ],
    },
    {
      name: 'Trapper',
      summary: 'Guards the path behind the bearer.',
      nodes: [
        active(1, SNARE, 'A trap that roots.'),
        planned(2, 'rearguard', 'Rearguard', 'P', 'Sets traps where the bearer just walked.'),
        planned(3, 'bait', 'Bait', 'A', 'A decoy that draws monsters for a few seconds.'),
        planned(4, 'spikeField', 'Spike Field', 'A', 'An area that slows and adds bleed.'),
        planned(
          5,
          'killingGround',
          'Killing Ground',
          'P',
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
        planned(3, 'arcVolley', 'Arc Volley', 'A', 'Several arrows. Each one chains.'),
        planned(4, 'lightningRod', 'Lightning Rod', 'A', 'A rod that makes a Storm field.'),
        planned(
          5,
          'thunderhead',
          'Thunderhead',
          'P',
          'Shock chains to every other Shocked enemy near.',
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
        planned(
          5,
          'martyr',
          'Martyr',
          'P',
          'When the Cleric dies, every dead ally near it rises at 20%.',
        ),
      ],
    },
    {
      name: 'Sanctuary',
      summary: 'Barriers.',
      nodes: [
        planned(
          1,
          'ward',
          'Ward',
          'A',
          'A pool on an ally or the bearer that absorbs magic damage.',
        ),
        planned(2, 'sacredGround', 'Sacred Ground', 'A', 'An area that heals over time.'),
        planned(
          3,
          'wallOfFaith',
          'Wall of Faith',
          'A',
          'A tile that stops a number of melee hits.',
        ),
        planned(4, 'veil', 'Veil', 'A', 'An area that stops ranged physical hits.'),
        planned(
          5,
          'aegis',
          'Aegis',
          'P',
          'The bearer always has a Ward that refills outside combat.',
        ),
      ],
    },
    {
      name: 'Inquisition',
      summary: 'Fights the Occult and the dead.',
      nodes: [
        active(1, SMITE, 'Radiant damage.'),
        planned(2, 'holyLight', 'Holy Light', 'P', '+Sear buildup.'),
        planned(
          3,
          'turnUndead',
          'Turn Undead',
          'A',
          'A chance to destroy a non-boss Undead at once.',
        ),
        planned(
          4,
          'consecrate',
          'Consecrate',
          'A',
          'A Radiant field. Corpses in it cannot be raised.',
        ),
        planned(5, 'purge', 'Purge', 'P', 'Occult enemies take 25% more damage from the party.'),
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

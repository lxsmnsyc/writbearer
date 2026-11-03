import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Cleric's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: cleric-upgrades builds them. The tree skills they come from are in
// src/content/cleric.ts and src/content/skills.ts.

const CLERIC_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'cleanse',
    'ward',
    'Cleanse',
    'Also removes harmful statuses and clears their buildup from the target.',
  ),
  designedUpgrade(
    'wallOfFaith',
    'ward',
    'Wall of Faith',
    "Also puts a barrier on the target's tile that stops the next few melee blows on anyone in it.",
  ),
  designedUpgrade(
    'twinWard',
    'ward',
    'Twin Ward',
    'Casts on the two allies in most danger. Each gets 60% of the pool.',
  ),
  designedUpgrade(
    'renew',
    'heal',
    'Renew',
    'Becomes a heal over time for 6 seconds. 12 mana, 5 second cooldown.',
  ),
  designedUpgrade(
    'resurrection',
    'heal',
    'Resurrection',
    'Can target a dead merc. It costs 30 mana and has a 20 second cooldown. A long windup, then it rises.',
  ),
  designedUpgrade(
    'martyr',
    'heal',
    'Martyr',
    'When the Cleric dies, every dead ally within 5 tiles rises with 20% health. Heal itself is unchanged.',
  ),
  designedUpgrade(
    'veil',
    'sacredGround',
    'Veil',
    'Becomes a 2.5-tile veil around the bearer. It stops ranged physical hits inside. It does not heal. 18 mana, 15 second cooldown.',
  ),
  designedUpgrade(
    'consecrate',
    'sacredGround',
    'Consecrate',
    'The ground also burns enemies inside with Radiant magic damage each second.',
  ),
  designedUpgrade(
    'pilgrimsRest',
    'sacredGround',
    "Pilgrim's Rest",
    'Allies inside also regain 2 mana a second and 0.5 morale a second.',
  ),
  designedUpgrade(
    'turnUndead',
    'smite',
    'Turn Undead',
    'Also a chance, higher as the target is hurt, to destroy a non-boss Undead.',
  ),
  designedUpgrade(
    'purge',
    'smite',
    'Purge',
    'Marks an Occult target for 8 seconds. The party deals 25% more damage to it.',
  ),
  designedUpgrade(
    'holyLight',
    'smite',
    'Holy Light',
    'Doubles the Sear buildup, and half of it spreads to enemies within 2 tiles of the target.',
  ),
];

export default CLERIC_UPGRADES;

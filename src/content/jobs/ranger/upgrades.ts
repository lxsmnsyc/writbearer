import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Ranger's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: ranger-upgrades builds them. The tree skills they come from are in
// src/content/ranger.ts, src/content/passives.ts and src/content/skills.ts.

const RANGER_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'rearguard',
    'snare',
    'Rearguard',
    'Also lays a snare where the bearer stood 5 seconds ago. In a fight, it lays one by itself every 7 seconds. Two at a time.',
  ),
  designedUpgrade(
    'bait',
    'snare',
    'Bait',
    'Becomes a decoy placed past the nearest threat. Monsters within 5 tiles go to it. Bosses ignore it.',
  ),
  designedUpgrade(
    'spikeField',
    'snare',
    'Spike Field',
    'Becomes a 2-tile field for 6 seconds. It slows by half and bleeds 1% of max health a second. It does not root.',
  ),
  designedUpgrade(
    'killingGround',
    'lightningRod',
    'Killing Ground',
    'When the bearer shouts Hold, the rod is planted on the Hold point at once and ringed with 6 snares.',
  ),
  designedUpgrade(
    'stormCell',
    'lightningRod',
    'Storm Cell',
    'Each strike adds 20 Shock buildup. An enemy that becomes Shocked in the field is stunned for 1 second.',
  ),
  designedUpgrade(
    'overcharge',
    'lightningRod',
    'Overcharge',
    'When the field ends it bursts for 150% damage and 40 Shock buildup on every enemy inside.',
  ),
  designedUpgrade(
    'pinDown',
    'aimedShot',
    'Pin Down',
    'Also roots the target. It grounds a flyer once flyers exist.',
  ),
  designedUpgrade(
    'eagleEye',
    'aimedShot',
    'Eagle Eye',
    '+3 tiles of reach. It never misses a flyer, once flyers exist.',
  ),
  designedUpgrade(
    'killshot',
    'aimedShot',
    'Killshot',
    'A shot at an enemy that had not noticed the party is a critical at double damage and needs no windup.',
  ),
  designedUpgrade(
    'arcVolley',
    'chargedArrow',
    'Arc Volley',
    'Fires 3 arrows at different enemies, 70% damage each. Each chains once.',
  ),
  designedUpgrade(
    'thunderhead',
    'chargedArrow',
    'Thunderhead',
    'A Shocked target sends a bolt to every Shocked enemy within 6 tiles for 60% Storm damage.',
  ),
  designedUpgrade(
    'piercingArrow',
    'chargedArrow',
    'Piercing Arrow',
    'Does not chain. Hits every enemy in a line.',
  ),
];

export default RANGER_UPGRADES;

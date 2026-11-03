import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Arcanist's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: arcanist-upgrades builds them.

const ARCANIST_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'glacialWall',
    'frostNova',
    'Glacial Wall',
    'Becomes a wall of ice between the bearer and the enemies. It blocks the path.',
  ),
  designedUpgrade(
    'rimefield',
    'frostNova',
    'Rimefield',
    'The ring leaves a frost field for 5 seconds. Enemies in it are slowed by 40%.',
  ),
  designedUpgrade(
    'coldSnap',
    'frostNova',
    'Cold Snap',
    'Also fires by itself when an enemy first touches the Arcanist, once every 12 seconds, free.',
  ),
  designedUpgrade(
    'volcano',
    'fireball',
    'Volcano',
    'Leaves a Fire field for 4 seconds. Allies inside deal 20% more Fire damage.',
  ),
  designedUpgrade(
    'inferno',
    'fireball',
    'Inferno',
    "A 4-tile area. It costs 32 mana and has a 12 second cooldown. It has friendly fire, unless the Arcanist's effective Discipline is 60 or more.",
  ),
  designedUpgrade('echo', 'fireball', 'Echo', 'A 25% chance to cast it again for free.'),
  designedUpgrade(
    'chill',
    'frostShard',
    'Chill',
    'Also slows the target by 30% for 3 seconds and adds chill buildup.',
  ),
  designedUpgrade(
    'shatterpoint',
    'frostShard',
    'Shatterpoint',
    'An enemy killed while Frozen shatters for Frost damage to enemies within 2 tiles. It leaves no corpse.',
  ),
  designedUpgrade(
    'overchannel',
    'frostShard',
    'Overchannel',
    'At 0 mana, it costs 5% of max health instead.',
  ),
  designedUpgrade(
    'ignite',
    'firebolt',
    'Ignite',
    'Burn buildup is doubled. A burning enemy that dies spreads Burn to enemies within 2 tiles.',
  ),
  designedUpgrade('manaFlow', 'firebolt', 'Mana Flow', 'Each hit returns 3 mana.'),
  designedUpgrade(
    'piercingBolt',
    'firebolt',
    'Piercing Bolt',
    'Passes through up to 3 enemies in a line.',
  ),
];

export default ARCANIST_UPGRADES;

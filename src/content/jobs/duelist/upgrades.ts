import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Duelist's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: duelist-upgrades builds them.

const DUELIST_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'grandDuel',
    'duel',
    'Grand Duel',
    'Lasts until one of them dies. The Duelist gets +50% crit rate during it.',
  ),
  designedUpgrade(
    'crowdPleaser',
    'duel',
    'Crowd Pleaser',
    "During the Duel, the party's morale rises by 1 a second.",
  ),
  designedUpgrade(
    'tauntTheProud',
    'duel',
    'Taunt the Proud',
    'Can be cast on an elite up to 6 tiles away. It walks to the Duelist and the Duel begins.',
  ),
  designedUpgrade(
    'flourish',
    'shadowstep',
    'Flourish',
    'A kill with it restores 15 mana and 1 morale, and resets its cooldown.',
  ),
  designedUpgrade(
    'smokeStep',
    'shadowstep',
    'Smoke Step',
    'Leaves a cloud on the start tile. Enemies lose track of the Duelist for 3 seconds.',
  ),
  designedUpgrade(
    'assassinsMark',
    'shadowstep',
    "Assassin's Mark",
    "The target takes 20% more damage from the Duelist's next 3 hits.",
  ),
  designedUpgrade('feint', 'lunge', 'Feint', 'The thrust cannot be blocked.'),
  designedUpgrade(
    'sidestep',
    'lunge',
    'Sidestep',
    'Ends with a sidestep: +30% evasion for 3 seconds.',
  ),
  designedUpgrade(
    'untouchable',
    'lunge',
    'Untouchable',
    'Fires by itself right after an evade, as a critical.',
  ),
  designedUpgrade(
    'bleedOut',
    'flurry',
    'Bleed Out',
    'Crits add bleed, which deals True damage over time.',
  ),
  designedUpgrade(
    'thousandCuts',
    'flurry',
    'Thousand Cuts',
    'Each hit in a row on the same target adds 3% damage. Switching targets resets it.',
  ),
  designedUpgrade(
    'whirlwind',
    'flurry',
    'Whirlwind',
    'The four hits strike every enemy within 2 tiles of the Duelist, one hit each in turn.',
  ),
];

export default DUELIST_UPGRADES;

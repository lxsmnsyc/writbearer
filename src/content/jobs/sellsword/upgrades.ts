import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Sellsword's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: sellsword-upgrades builds them.

const SELLSWORD_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'shieldRush',
    'rush',
    'Shield Rush',
    'After it arrives, the Sellsword taunts that enemy for 3 seconds.',
  ),
  designedUpgrade(
    'chainRush',
    'rush',
    'Chain Rush',
    'If the target dies within 2 seconds, it rushes the next enemy attacking the bearer, free.',
  ),
  designedUpgrade(
    'knockAside',
    'rush',
    'Knock Aside',
    'The target is pushed 2 tiles away from the bearer.',
  ),
  designedUpgrade(
    'bribe',
    'pocketSand',
    'Bribe',
    'Becomes a bribe. It costs gold and 12 mana, and a non-elite Human enemy leaves the fight.',
  ),
  designedUpgrade(
    'playDead',
    'pocketSand',
    'Play Dead',
    'The first time the Sellsword would die in a stage, it throws sand, lies still for 3 seconds and gets up with 20% health.',
  ),
  designedUpgrade(
    'saltTheWound',
    'pocketSand',
    'Salt the Wound',
    'Blinded enemies take 15% more damage from every merc.',
  ),
  designedUpgrade(
    'lowBlow',
    'hamstring',
    'Low Blow',
    '+25% crit rate against blinded or slowed targets.',
  ),
  designedUpgrade(
    'cutpurse',
    'hamstring',
    'Cutpurse',
    'Each hit has a 15% chance to steal one buff from the target and keep it.',
  ),
  designedUpgrade(
    'cripple',
    'hamstring',
    'Cripple',
    'Hamstring on an already slowed target roots it for 1.5 seconds.',
  ),
  designedUpgrade(
    'weaponHabit',
    'cleave',
    'Weapon Habit',
    '+20% attack speed with the weapon type the Sellsword has used longest this run.',
  ),
  designedUpgrade(
    'veteranOfManyWars',
    'cleave',
    'Veteran of Many Wars',
    'Cleave counts as 1 rank higher for each phase the Sellsword survives, up to +3.',
  ),
  designedUpgrade(
    'pocketChange',
    'cleave',
    'Pocket Change',
    'Enemies killed by Cleave drop 50% more gold.',
  ),
];

export default SELLSWORD_UPGRADES;

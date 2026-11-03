import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Warden's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: warden-upgrades builds them.

const WARDEN_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'livingShield',
    'cover',
    'Living Shield',
    'During Cover, Interpose takes 40% and each hit taken becomes a Ward on the Warden.',
  ),
  designedUpgrade(
    'tether',
    'cover',
    'Tether',
    "The Warden dashes to the bearer's side on cast, then follows the bearer at +30% speed, never more than 3 tiles away.",
  ),
  designedUpgrade(
    'retaliate',
    'cover',
    'Retaliate',
    'During Cover, anyone who damages the bearer takes a free attack from the Warden.',
  ),
  designedUpgrade(
    'bloodDebt',
    'execute',
    'Blood Debt',
    "A kill heals the bearer for 10% of the enemy's max health.",
  ),
  designedUpgrade(
    'hangmansReach',
    'execute',
    "Hangman's Reach",
    'The Warden first leaps up to 3 tiles to the target.',
  ),
  designedUpgrade(
    'lastRites',
    'execute',
    'Last Rites',
    'A kill resets Pursue and marks the nearest enemy.',
  ),
  designedUpgrade(
    'sentry',
    'tripwire',
    'Sentry',
    'While the trap stands, it reveals hidden and invisible enemies within 6 tiles of it.',
  ),
  designedUpgrade(
    'trapField',
    'tripwire',
    'Trap Field',
    'The trap is a 2.5-tile field. Every enemy that enters it is marked and slowed.',
  ),
  designedUpgrade(
    'neverSurprised',
    'tripwire',
    'Never Surprised',
    'In an ambush, a Tripwire is already set at the entrance, and ambushers start stunned for 1 second.',
  ),
  designedUpgrade(
    'markedForDeath',
    'pursue',
    'Marked for Death',
    'Every merc deals 10% more damage to marked enemies.',
  ),
  designedUpgrade(
    'debtCollector',
    'pursue',
    'Debt Collector',
    '+25% crit rate against marked enemies.',
  ),
  designedUpgrade(
    'readTheRoom',
    'pursue',
    'Read the Room',
    'Can leap to a hidden or disguised enemy and reveals it. It also reveals disguised enemies at the start of a stage.',
  ),
];

export default WARDEN_UPGRADES;

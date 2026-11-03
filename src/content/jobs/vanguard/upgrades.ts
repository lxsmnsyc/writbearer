import type { Upgrade } from '../../../sim/builds';
import { designedUpgrade } from '../designed';

// The Vanguard's 12 elite upgrades, from docs/design/16-builds.md. Summary
// only: vanguard-upgrades builds them. The tree skills they come from are in
// src/content/vanguard.ts, src/content/passives.ts and src/content/skills.ts.

const VANGUARD_UPGRADES: Upgrade[] = [
  designedUpgrade(
    'vow',
    'intercept',
    'Vow',
    'On arrival, the Vanguard and the bearer gain +20 armor for 6 seconds.',
  ),
  designedUpgrade(
    'sharedBurden',
    'intercept',
    'Shared Burden',
    'For 5 seconds after the dash, the Vanguard takes 30% of every hit on the bearer.',
  ),
  designedUpgrade(
    'charge',
    'intercept',
    'Charge',
    'Each enemy the dash passes through gets 40 stun buildup and is pushed aside.',
  ),
  designedUpgrade(
    'lastLine',
    'challenge',
    'Last Line',
    'Also fires by itself, once an area, when the bearer drops below 30% health. It taunts within 5 tiles of the bearer.',
  ),
  designedUpgrade(
    'banner',
    'challenge',
    'Banner',
    'Also plants a banner for 10 seconds. Allies within 4 tiles gain morale and take half the dread buildup.',
  ),
  designedUpgrade(
    'shieldBash',
    'challenge',
    'Shield Bash',
    'Becomes a shove on one enemy: 100% damage, stun buildup, interrupts casts. It taunts only that enemy.',
  ),
  designedUpgrade(
    'immovable',
    'shieldWall',
    'Immovable',
    'No stun, Petrify or Dread during it. Lasts 1 second longer.',
  ),
  designedUpgrade(
    'rampart',
    'shieldWall',
    'Rampart',
    'Plants a wall toward the nearest archer instead. The Vanguard can move. Projectiles that fly into the wall stop.',
  ),
  designedUpgrade(
    'bastion',
    'shieldWall',
    'Bastion',
    'Allies within 2 tiles behind it get the same cover from the front.',
  ),
  designedUpgrade(
    'faultLine',
    'crush',
    'Fault Line',
    "Becomes a 5-tile shockwave in a line. Every enemy in it takes 80% of Crush's damage and buildup.",
  ),
  designedUpgrade(
    'earthshaker',
    'crush',
    'Earthshaker',
    'When the target is Petrified, every enemy within 3 tiles of it gets 40 Earth buildup.',
  ),
  designedUpgrade(
    'sunderingBlow',
    'crush',
    'Sundering Blow',
    'Puts all 5 Sunder stacks on the target at once.',
  ),
];

export default VANGUARD_UPGRADES;

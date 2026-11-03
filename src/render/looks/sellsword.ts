import { heldGear } from './held';
import type { JobLook } from './types';

// The Sellsword: drawn a little larger than the others, with one big sword
// and nothing else. No shield is drawn, so the blade is the signature shape.
const SELLSWORD_LOOK: JobLook = {
  hitFraction: 0.55,
  size: 1.1,
  bare: { weapon: 'sword', shield: false },
  attachments: (weapon) => heldGear(weapon),
  attack: () => 'slash',
};

export default SELLSWORD_LOOK;

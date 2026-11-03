import { heldGear } from './held';
import type { JobLook } from './types';

// Placeholder: robed, with a plain staff, casting. The arcanist node draws
// its own look.
const ARCANIST_LOOK: JobLook = {
  hitFraction: 0.7,
  size: 1,
  bare: { weapon: 'staff', shield: false },
  attachments: (weapon) => ['robe', ...heldGear(weapon)],
  attack: () => 'cast',
};

export default ARCANIST_LOOK;

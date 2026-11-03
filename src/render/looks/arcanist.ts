import { heldGear } from './held';
import type { JobLook } from './types';

// The Arcanist: a tall robe and a plain staff held up to cast. No sash and
// no sunburst, so the long staff over the robe is the signature shape and
// the figure does not read as the Cleric.
const ARCANIST_LOOK: JobLook = {
  hitFraction: 0.55,
  size: 1.08,
  bare: { weapon: 'staff', shield: false },
  attachments: (weapon) => ['robe', ...heldGear(weapon)],
  attack: () => 'cast',
};

export default ARCANIST_LOOK;

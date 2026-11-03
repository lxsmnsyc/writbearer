import { heldGear } from './held';
import type { JobLook } from './types';

// The Warden: hooded, with a mace and a lantern held up as the watch. The
// lantern is its signature shape.
const WARDEN_LOOK: JobLook = {
  hitFraction: 0.6,
  size: 1,
  bare: { weapon: 'mace', shield: false },
  attachments: (weapon) => ['hood', 'lantern', ...heldGear(weapon)],
  attack: () => 'slash',
};

export default WARDEN_LOOK;

import { heldGear, swingOrShoot } from './held';
import type { JobLook } from './types';

// The Ranger: hooded, with its bow. It never carries a shield.
const RANGER_LOOK: JobLook = {
  hitFraction: 0.7,
  size: 1,
  bare: { weapon: 'bow', shield: false },
  attachments: (weapon) => ['hood', ...heldGear(weapon)],
  attack: swingOrShoot,
};

export default RANGER_LOOK;

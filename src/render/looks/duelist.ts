import { heldGear } from './held';
import type { JobLook } from './types';

// The Duelist: slight and quick, with a sash and a dagger. No shield is
// drawn, so the lone blade is the signature shape.
const DUELIST_LOOK: JobLook = {
  hitFraction: 0.5,
  size: 0.95,
  bare: { weapon: 'dagger', shield: false },
  attachments: (weapon) => ['sash', ...heldGear(weapon)],
  attack: () => 'slash',
};

export default DUELIST_LOOK;

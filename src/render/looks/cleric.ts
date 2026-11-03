import { heldGear } from './held';
import type { JobLook } from './types';

// The Cleric: robed, with a red sash. Its staff is the sunburst staff, and
// it prays rather than swings.
const CLERIC_LOOK: JobLook = {
  hitFraction: 0.7,
  size: 1,
  bare: { weapon: 'staff', shield: false },
  attachments: (weapon) => ['robe', 'sash', ...heldGear(weapon, 'sunStaff')],
  attack: () => 'cast',
};

export default CLERIC_LOOK;

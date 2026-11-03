import type { Attachment } from '../sprites';
import type { Attack, HeldWeapon, JobLook } from './types';

/** A held weapon as attachments: none, or its own. `asStaff` replaces a plain staff. */
export function heldGear(weapon: HeldWeapon | null, asStaff: Attachment = 'staff'): Attachment[] {
  if (!weapon) {
    return [];
  }
  return [weapon === 'staff' ? asStaff : weapon];
}

/** A bow shoots; anything else swings. */
export const swingOrShoot = (weapon: HeldWeapon | null): Attack =>
  weapon === 'bow' ? 'shoot' : 'slash';

/**
 * A plain fighter's look: its weapon, and a shield if it has one. For jobs
 * whose own look is not drawn yet.
 */
export const plainLook = (weapon: HeldWeapon, shield: boolean): JobLook => ({
  hitFraction: 0.6,
  size: 1,
  bare: { weapon, shield },
  attachments: (held, hasShield) => [
    ...heldGear(held),
    ...(hasShield ? (['towerShield'] as const) : []),
  ],
  attack: swingOrShoot,
});

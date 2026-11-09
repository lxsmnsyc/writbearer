import type { StatusDef } from './status';
import type Unit from './unit';

// Same buildup rule as the other element statuses in statuses.ts. Copied here
// so statuses.ts can import this module without a cycle.
const BASE_THRESHOLD = 100;
const thresholdOnWil = (u: Unit): number =>
  Math.round(BASE_THRESHOLD * (1 + (u.base.wil * 3) / 100) + u.level * 2);

// Share of armor and resistance a body loses while its spirit is loose.
export const UNMOORED_LOSS = 20;

/**
 * Spectral. The spirit slips its body, and the body's guard goes with it:
 * the unit takes less from armor and resistance. A debuff only; it does not
 * change the unit's element. Built up by Spectral hits, resisted by WIL.
 */
export const UNMOORED: StatusDef = {
  id: 'unmoored',
  name: 'Unmoored',
  duration: 5,
  immunity: 4,
  threshold: thresholdOnWil,
  modifiers: () => [
    { stat: 'armor', percent: -UNMOORED_LOSS },
    { stat: 'resistance', percent: -UNMOORED_LOSS },
  ],
};

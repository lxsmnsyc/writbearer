import type { Prop } from '../../../gen/stage';
import type { Pt } from '../../draw';
import type { Light } from '../../light';
import DUNGEON_PROPS from './dungeon';
import FIRE_PROPS from './fires';
import RUIN_PROPS from './ruins';
import { peg } from './shapes';
import TOWN_PROPS from './town';
import type { PropLooks } from './types';

export type { PropLook, PropLooks } from './types';

/**
 * How each prop is drawn, by prop kind. A new prop kind adds one entry to
 * one of the group files, or a file of its own merged in here. Kinds
 * without an entry are drawn as a short pale peg.
 */
export const PROP_LOOKS: PropLooks = {
  ...RUIN_PROPS,
  ...TOWN_PROPS,
  ...DUNGEON_PROPS,
  ...FIRE_PROPS,
};

/** Draws a prop standing at `base`, in design pixels. */
export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, base: Pt, time: number): void {
  const look = PROP_LOOKS[p.kind];
  if (look) {
    look.draw(ctx, p, base, time);
  } else {
    peg(ctx, base);
  }
}

/** The light a prop gives, if any. */
export function propLight(p: Prop): Light | null {
  return PROP_LOOKS[p.kind]?.light?.(p) ?? null;
}

/** Draws what of a prop shines through the dark, at `at` on the small frame. */
export function drawPropFlame(ctx: CanvasRenderingContext2D, p: Prop, at: Pt, time: number): void {
  PROP_LOOKS[p.kind]?.flame?.(ctx, p, at, time);
}

/** Whether a prop has anything to draw through the dark. */
export function hasFlame(p: Prop): boolean {
  return PROP_LOOKS[p.kind]?.flame !== undefined;
}

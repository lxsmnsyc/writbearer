import type { Prop } from '../../../gen/stage';
import type { Pt } from '../../draw';
import type { Light } from '../../light';

/** How one kind of prop is drawn. */
export interface PropLook {
  /**
   * Draws the prop standing at `base`, in design pixels: the renderer
   * scales the canvas by the zoom first. `time` is in seconds.
   */
  draw: (ctx: CanvasRenderingContext2D, p: Prop, base: Pt, time: number) => void;
  /** The light it gives, if any, added to the light map in prop order. */
  light?: (p: Prop) => Light;
  /**
   * Draws what shines through the dark, after the light, at `at` on the
   * small frame (not scaled). Called only once the party has seen its
   * place. The fill color is flame when it is called.
   */
  flame?: (ctx: CanvasRenderingContext2D, p: Prop, at: Pt, time: number) => void;
}

/** Looks by prop kind. Each prop file exports one of these. */
export type PropLooks = Partial<Record<Prop['kind'], PropLook>>;

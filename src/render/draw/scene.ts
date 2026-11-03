import type { Prop } from '../../gen/stage';
import type Unit from '../../sim/unit';
import type { Pt } from '../draw';
import type { Frame } from '../renderer';
import { type Iso, look } from '../rig';

// The frame is drawn small and scaled up with no smoothing.
export const W = 384;
export const H = 216;
export const SCALE = 3;

// A tile is 32 by 16 pixels on screen, times the zoom.
const TW = 32;
const TH = 16;
export const tw = (): number => TW * look.zoom;
export const th = (): number => TH * look.zoom;

/**
 * What the draw modules draw with. `ctx` is the small frame, `out` the
 * scaled-up screen. `iso` places the ground and what stands still on it,
 * `body` a moving figure (see `Renderer.body`). `sub` is the share of a
 * pixel the frame is shifted by when scaled up.
 */
export interface Scene {
  readonly ctx: CanvasRenderingContext2D;
  readonly out: CanvasRenderingContext2D;
  // A frame-sized canvas for drawing a prop on its own before it is dimmed
  readonly scratch: CanvasRenderingContext2D;
  readonly iso: Iso;
  readonly body: Iso;
  readonly sub: Readonly<Pt>;
}

// Everything that stands in every area
export const propsOf = (f: Frame): Prop[] => f.areas.flatMap((a) => a.stage.props);

// What the camera and the lantern follow: the bearer, or once the seal
// breaks, the Creditor in its body.
export const focusOf = (f: Frame): Unit | null => f.sim.bearer ?? (f.stage.tomb ? f.boss : null);

// Whether a floor point's screen spot is near enough the frame to draw what stands there.
export function onScreen(b: Pt): boolean {
  return b.x > -64 && b.x < W + 64 && b.y > -24 && b.y < H + 120;
}

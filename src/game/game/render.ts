// Draws the run as it stands, and exposes what browser tests need on the
// canvas.
import type GameState from './state';
import { COLLAPSE_FADE } from './areas';
import { figures } from './encounter';
import { exitsOpen } from './fight';
import { region } from './route';

export default function render(g: GameState, alpha: number): void {
  g.renderer.render({
    sim: g.sim,
    stage: g.stage,
    areas: [
      { stage: g.stage, alpha: 1 },
      ...(g.ahead ? [{ stage: g.ahead.stage, alpha: 1 }] : []),
      ...(g.behind ? [{ stage: g.behind.stage, alpha: 1 }] : []),
      ...(g.fading ? [{ stage: g.fading.stage, alpha: 1 - g.fading.t / COLLAPSE_FADE }] : []),
    ],
    views: g.views,
    effects: g.effects,
    alpha,
    time: g.time,
    slain: g.slain,
    ground: g.ground,
    figures: figures(g),
    over: g.over,
    ending: g.finale?.ending ?? null,
    region: region(g),
    hoverExit: g.hoverExit,
    exitsShut: !exitsOpen(g) && g.objective?.hidden() !== true,
    spots: g.options.director === true,
    dark: g.mutators.has('darkness'),
    leaving: g.leaving,
    seed: g.streams.seed,
    paused: g.paused,
    selected: g.selected,
    shake: g.shake,
    boss: g.boss,
    notice: g.notice && g.notice.until > g.time ? g.notice.text : null,
    callout: g.callout && g.callout.until > g.time ? g.callout.text : null,
  });
  const canvas = g.canvas;
  // Exposed for browser tests, which cannot see inside the canvas.
  canvas.dataset.bearer = `${g.bearer.x.toFixed(2)},${g.bearer.z.toFixed(2)}`;
  const cam = g.renderer.camera;
  canvas.dataset.camera = `${cam.x},${cam.y}`;
  // How the final fight stands: not begun, under way, or how it ended.
  canvas.dataset.finale = g.finale ? (g.finale.ending ?? 'fighting') : 'none';
  // Each recruit waiting to be hired, as shares of the canvas.
  canvas.dataset.recruits = g.wanderers
    .map((w) => {
      const p = g.renderer.shareOnScreen(w.x, w.z);
      return `${w.offer.name}/${w.offer.kind}:${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    })
    .join(';');
  // Each exit's plate, north first, as shares of the canvas, so tests can click them.
  canvas.dataset.exits = g.stage.exits
    .map((e) => {
      const p = g.renderer.shareOnScreen(e.x, e.z);
      return `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    })
    .join(';');
  // Each merc's feet, as shares of the canvas, so tests can click them.
  canvas.dataset.mercs = g
    .mercs()
    .map((m) => {
      const p = g.renderer.shareOnScreen(m.x, m.z);
      return `${m.name}:${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    })
    .join(';');
}

import type Unit from '../../sim/unit';
import { type Pt, pt } from '../draw';
import { drawPiece } from '../effects';
import type { Fogs } from '../fog';
import type { Frame } from '../renderer';
import { isKind, look } from '../rig';
import { drawFigure, seen } from './figures';
import { drawProp } from './props';
import { type Scene, onScreen, propsOf } from './scene';

/** One thing that stands on the floor, drawn back to front by `depth`. */
export interface Standing {
  depth: number;
  draw: () => void;
}

/**
 * Everything that stands, sorted back to front by `x + z`: props, units,
 * figures that wait in the area, and pieces flying through the air.
 */
export function drawStanding(s: Scene, f: Frame, fog: Fogs, bearer: Unit | null): void {
  const { ctx, iso, body } = s;
  const z = look.zoom;
  const list: Standing[] = [];
  for (const p of propsOf(f)) {
    const b = iso(p.x, p.z);
    // Props stay where they were seen, dimmed while out of sight.
    if (!onScreen(b) || !fog.knownAround(p.x, p.z, p.r ?? 0.3)) {
      continue;
    }
    const dim = (1 - fog.visibleAround(p.x, p.z, p.r ?? 0.3)) * 0.62;
    list.push({
      depth: p.x + p.z,
      draw: () => {
        dimmed(s, dim, b, (c) => {
          // Props are drawn in design pixels, scaled to the zoom.
          c.save();
          c.translate(b.x, b.y);
          c.scale(z, z);
          drawProp(c, p, pt(0, 0), f.time);
          c.restore();
        });
      },
    });
  }
  for (const u of f.sim.units) {
    // The dead stay where they fell, unless they were torn apart.
    if (u.alive || !f.effects.gibbed.has(u)) {
      const r = f.views.rig(u, f.alpha);
      const shown = seen(fog, u, r.x, r.z);
      if (shown <= 0.05) {
        continue;
      }
      list.push({
        depth: r.x + r.z,
        draw: () => {
          ctx.globalAlpha = shown;
          drawFigure(ctx, r, body, f.time, f.views.get(u).hurt < 0.12);
          ctx.globalAlpha = 1;
        },
      });
    }
  }
  for (const w of f.figures) {
    if (fog.visible(w.x, w.z) <= 0.05 || !isKind(w.kind)) {
      continue;
    }
    const kind = w.kind;
    // It turns to watch the bearer come, unless it lies dead.
    const angle = bearer && !w.fallen ? Math.atan2(bearer.z - w.z, bearer.x - w.x) : Math.PI * 0.75;
    list.push({
      depth: w.x + w.z,
      draw: () => {
        ctx.globalAlpha = fog.visible(w.x, w.z);
        drawFigure(
          ctx,
          {
            kind,
            x: w.x,
            z: w.z,
            angle,
            walk: 0,
            stride: 0,
            atk: -1,
            shout: -1,
            fall: w.fallen ? 1 : -1,
            hurt: 9,
            alert: false,
          },
          iso,
          f.time,
          false,
        );
        ctx.globalAlpha = 1;
      },
    });
  }
  for (const p of f.effects.pieces) {
    if (p.h > 0 && fog.visible(p.x, p.z) > 0.5) {
      list.push({
        depth: p.x + p.z,
        draw: () => {
          drawPiece(ctx, iso, p);
        },
      });
    }
  }
  list.sort((a, b) => a.depth - b.depth);
  for (const item of list) {
    item.draw();
  }
}

// Draws a prop at `at` darkened by `amount`, without darkening what is
// behind it. Only the box around the prop is touched.
function dimmed(
  s: Scene,
  amount: number,
  at: Pt,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (amount < 0.02) {
    draw(s.ctx);
    return;
  }
  const z = look.zoom;
  const x = Math.floor(at.x - 48 * z);
  const y = Math.floor(at.y - 96 * z);
  const w = Math.ceil(96 * z);
  const h = Math.ceil(124 * z);
  const c = s.scratch;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(x, y, w, h);
  draw(c);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = `rgba(0,0,0,${amount})`;
  c.fillRect(x, y, w, h);
  s.ctx.drawImage(c.canvas, x, y, w, h, x, y, w, h);
}

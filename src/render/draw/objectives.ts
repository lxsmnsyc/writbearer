import { RITE_TIME, floorOf, rectOf } from '../../gen/stage';
import { type Pt, fillPoly, pt } from '../draw';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { look } from '../rig';
import type { Scene } from './scene';

// How far ahead of a Collapse's edge the ground shows it will fall, in
// tiles: the next tile to go
const FALL_WARN = 1;
// A broken sigil, wiped dull
const BROKEN_SIGIL = '#3a3a3a';

// The Church's sealing sigil, painted in blood on the floor.
export function drawSigil(s: Scene, at: { x: number; z: number }, color: string = C.blood): void {
  const { ctx } = s;
  const sc = s.iso(at.x, at.z);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const z = look.zoom;
  ctx.lineWidth = z;
  ctx.ellipse(sc.x, sc.y, 52 * z, 26 * z, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  [0, 2, 4, 1, 3].forEach((i, k) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const q = pt(sc.x + Math.cos(a) * 46 * z, sc.y + Math.sin(a) * 23 * z);
    if (k) {
      ctx.lineTo(q.x, q.y);
    } else {
      ctx.moveTo(q.x, q.y);
    }
  });
  ctx.closePath();
  ctx.stroke();
}

// A Collapse's fallen floor: the void, with a ragged lip of rock where
// the ground breaks off, and the strip about to fall flashing red.
export function drawCollapse(s: Scene, f: Frame): void {
  const { ctx, iso } = s;
  for (const stage of f.areas.map((a) => a.stage)) {
    const c = stage.collapse;
    if (!c || c.front >= c.stop + 1) {
      continue;
    }
    const all = rectOf(stage);
    const standing = floorOf(stage);
    // The edge runs across the field; `at` places a point by how far
    // along the edge it is and how far from it toward the fall.
    const across = c.dir.x === 0 ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const span = c.dir.x === 0 ? all.x1 - all.x0 : all.z1 - all.z0;
    let edge: { x: number; z: number };
    if (c.dir.x > 0) {
      edge = { x: standing.x0, z: all.z0 };
    } else if (c.dir.x < 0) {
      edge = { x: standing.x1, z: all.z0 };
    } else if (c.dir.z > 0) {
      edge = { x: all.x0, z: standing.z0 };
    } else {
      edge = { x: all.x0, z: standing.z1 };
    }
    const at = (t: number, back: number): Pt =>
      iso(edge.x + across.x * t - c.dir.x * back, edge.z + across.z * t - c.dir.z * back);
    const steps = Math.ceil(span);
    const ragged = (k: number): number => ((((Math.sin(k * 12.9898) * 43758.5) % 1) + 1) % 1) * 0.5;
    if (c.front >= 1) {
      const lip = Array.from({ length: steps + 1 }, (_, k) => at(k, ragged(k)));
      const fallen = Math.floor(c.front);
      fillPoly(ctx, [...lip, at(span, fallen), at(0, fallen)], C.void, null);
      ctx.strokeStyle = '#4e4c48';
      ctx.lineWidth = look.zoom;
      ctx.beginPath();
      lip.forEach((p, k) => {
        if (k) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.moveTo(p.x, p.y);
        }
      });
      ctx.stroke();
    }
    if (c.front < c.stop) {
      // The next strip to go: a red wash, and a pulsing crack where it
      // will break off
      const next = FALL_WARN;
      ctx.globalAlpha = 0.25;
      fillPoly(ctx, [at(0, 0), at(span, 0), at(span, -next), at(0, -next)], C.blood, null);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(f.time * 6);
      ctx.strokeStyle = C.blood;
      ctx.lineWidth = look.zoom;
      ctx.setLineDash([4 * look.zoom, 3 * look.zoom]);
      ctx.beginPath();
      const a = at(0, -next);
      const b = at(span, -next);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }
}

// A Ritual's sigils: one broken is wiped dull, and the one the bearer
// must stand on next fills with gold as it breaks.
export function drawRites(s: Scene, f: Frame): void {
  const { ctx } = s;
  const z = look.zoom;
  for (const stage of f.areas.map((a) => a.stage)) {
    const rites = stage.rites ?? [];
    const next = rites.find((r) => r.broken !== true);
    for (const r of rites) {
      if (r.broken === true) {
        drawSigil(s, r, BROKEN_SIGIL);
      }
    }
    if (!next) {
      continue;
    }
    const sc = s.iso(next.x, next.z);
    const pulse = 0.5 + Math.sin(f.time * 3) * 0.5;
    ctx.lineWidth = 2 * z;
    ctx.strokeStyle = pulse > 0.5 ? C.gold : '#7a5a22';
    ctx.beginPath();
    ctx.ellipse(sc.x, sc.y, 56 * z, 28 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (next.held > 0) {
      ctx.strokeStyle = C.flame;
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      const end = -Math.PI / 2 + (next.held / RITE_TIME) * Math.PI * 2;
      ctx.ellipse(sc.x, sc.y, 56 * z, 28 * z, 0, -Math.PI / 2, end);
      ctx.stroke();
    }
  }
}

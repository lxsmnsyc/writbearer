import { Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { seen } from './figures';
import { H, SCALE, type Scene, W } from './scene';

// How far in from the screen's edge the arrows to marked monsters stand, in pixels
const QUARRY_INSET = 26;

// An arrow at the screen's edge toward each marked monster the party has
// seen that is off the screen, so a Hunt's field need not be searched blind.
// `sighted` keeps the marked monsters seen so far.
export default function drawQuarry(s: Scene, f: Frame, fog: Fogs, sighted: WeakSet<Unit>): void {
  const w = W * SCALE;
  const h = H * SCALE;
  for (const u of f.sim.living(Side.Monster)) {
    if (!u.marked) {
      continue;
    }
    const r = f.views.rig(u, f.alpha);
    if (seen(fog, u, r.x, r.z) >= 0.5) {
      sighted.add(u);
    }
    const b = s.body(r.x, r.z);
    const x = b.x * SCALE - s.sub.x;
    const y = b.y * SCALE - s.sub.y;
    if (!sighted.has(u) || (x >= 0 && x <= w && y >= 0 && y <= h)) {
      continue;
    }
    pointAt(s.out, x, y, C.blood);
  }
  // A Ritual's next sigil, so the bearer can find it
  for (const stage of f.areas.map((a) => a.stage)) {
    const next = stage.rites?.find((r) => r.broken !== true);
    if (!next) {
      continue;
    }
    const b = s.iso(next.x, next.z);
    const x = b.x * SCALE - s.sub.x;
    const y = b.y * SCALE - s.sub.y;
    if (x < 0 || x > w || y < 0 || y > h) {
      pointAt(s.out, x, y, C.gold);
    }
  }
}

// An arrow at the screen's edge, along the line from its middle toward a
// point off it
function pointAt(out: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const w = W * SCALE;
  const h = H * SCALE;
  const dx = x - w / 2;
  const dy = y - h / 2;
  const k = Math.min(
    (w / 2 - QUARRY_INSET) / Math.abs(dx || 1),
    (h / 2 - QUARRY_INSET) / Math.abs(dy || 1),
  );
  const ax = w / 2 + dx * k;
  const ay = h / 2 + dy * k;
  const a = Math.atan2(dy, dx);
  const tip = (t: number, d: number): [number, number] => [
    ax + Math.cos(a + t) * d,
    ay + Math.sin(a + t) * d,
  ];
  out.beginPath();
  out.moveTo(...tip(0, 14));
  out.lineTo(...tip(2.5, 11));
  out.lineTo(...tip(-2.5, 11));
  out.closePath();
  out.fillStyle = color;
  out.strokeStyle = '#f2d8c9';
  out.lineWidth = 2;
  out.fill();
  out.stroke();
}

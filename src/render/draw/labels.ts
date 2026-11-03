import { AFFIX_NAME, affixesOf } from '../../content/affixes';
import { Rank, Side } from '../../sim/types';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { look } from '../rig';
import { barHeight, seen } from './figures';
import { SCALE, type Scene } from './scene';

// The bearer's shout, over its head for a moment. Leaves the 13px label
// font set after it.
export function drawCallout(s: Scene, f: Frame): void {
  const { out } = s;
  if (f.callout && f.sim.bearer) {
    const r = f.views.rig(f.sim.bearer, f.alpha);
    const b = s.body(r.x, r.z);
    out.font = '600 17px Inter, system-ui, sans-serif';
    out.fillStyle = C.gold;
    out.fillText(f.callout, b.x * SCALE - s.sub.x, (b.y - 46 * look.zoom) * SCALE - s.sub.y);
    out.font = '600 13px Inter, system-ui, sans-serif';
  }
}

// Who waits in the area, named over its head: a merc for hire, or
// whoever stands at an Event.
export function drawFigureLabels(s: Scene, f: Frame, fog: Fogs): void {
  const { out } = s;
  for (const w of f.figures) {
    if (!w.label || fog.visible(w.x, w.z) <= 0.5) {
      continue;
    }
    const b = s.iso(w.x, w.z);
    const text = w.label;
    const x = b.x * SCALE - s.sub.x;
    const y = (b.y - 52 * look.zoom) * SCALE - s.sub.y;
    const width = out.measureText(text).width + 8;
    out.fillStyle = 'rgba(0,0,0,0.65)';
    out.fillRect(x - width / 2, y - 14, width, 18);
    out.fillStyle = C.gold;
    out.fillText(text, x, y);
  }
}

// An elite's name and affixes over it once seen, so the threat can be
// read before the fight. Sets its own, smaller font.
export function drawEliteLabels(s: Scene, f: Frame, fog: Fogs): void {
  const { out } = s;
  out.font = '600 11px Inter, system-ui, sans-serif';
  const affixes = affixesOf(f.sim);
  for (const u of f.sim.living(Side.Monster)) {
    const has = u.rank === Rank.Normal ? [] : affixes.of(u);
    if (has.length === 0) {
      continue;
    }
    const r = f.views.rig(u, f.alpha);
    if (seen(fog, u, r.x, r.z) < 0.5) {
      continue;
    }
    const b = s.body(r.x, r.z);
    const text = `${u.name} · ${has.map((a) => AFFIX_NAME[a]).join(', ')}`;
    const x = b.x * SCALE - s.sub.x;
    const y = (b.y - (barHeight(u) + 6) * look.zoom) * SCALE - s.sub.y;
    const width = out.measureText(text).width + 8;
    out.fillStyle = 'rgba(0,0,0,0.65)';
    out.fillRect(x - width / 2, y - 12, width, 16);
    out.fillStyle = '#e8a0a0';
    out.fillText(text, x, y);
  }
}

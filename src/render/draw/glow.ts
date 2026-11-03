import { fillPoly, pt } from '../draw';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { look } from '../rig';
import { barHeight, glowsOf, seen } from './figures';
import { drawPropFlame, hasFlame } from './props';
import { type Scene, propsOf } from './scene';
import { drawStatuses } from './statuses';

// Eyes, growths and flames are drawn after the darkness, so they shine through it.
export default function drawGlow(s: Scene, f: Frame, fog: Fogs): void {
  const { ctx } = s;
  for (const u of f.sim.living()) {
    const r = f.views.rig(u, f.alpha);
    // The key to a Labyrinth's hall glints over whoever carries it.
    if (u.bearsKey) {
      const b = s.body(r.x, r.z);
      const top = b.y - Math.round((barHeight(u) + 10) * look.zoom);
      ctx.fillStyle = C.gold;
      ctx.fillRect(b.x - 3, top, 3, 3);
      ctx.fillRect(b.x, top + 1, 4, 1);
      ctx.fillRect(b.x + 3, top + 2, 1, 2);
    }
    // A captain carries a red pennant, even in the dark, so it can be picked out.
    if (u.calls.length > 0) {
      const b = s.body(r.x, r.z);
      const top = b.y - Math.round((barHeight(u) + 16) * look.zoom);
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x - 4, top, 1, 9);
      ctx.fillStyle = C.blood;
      ctx.fillRect(b.x - 3, top, 5, 2);
      ctx.fillRect(b.x - 3, top + 2, 3, 2);
    }
    // A Hunt's quarry is marked even in the dark, so the party can find it.
    if (u.marked) {
      const b = s.body(r.x, r.z);
      const top = b.y - Math.round((barHeight(u) + 12) * look.zoom);
      const bob = Math.round(Math.sin(f.time * 4) * 1.5);
      fillPoly(
        ctx,
        [pt(b.x - 4, top + bob), pt(b.x + 4, top + bob), pt(b.x, top + 6 + bob)],
        C.blood,
        C.ink,
      );
    }
    if (seen(fog, u, r.x, r.z) < 0.5) {
      continue;
    }
    drawStatuses(s, u, r.x, r.z, f.time);
    for (const e of glowsOf(r, s.body, f.time)) {
      if (e.color === 'teal') {
        ctx.fillStyle = C.teal;
      } else if (e.color === 'blood') {
        ctx.fillStyle = C.blood;
      } else {
        ctx.fillStyle = C.flame;
      }
      const size = e.color === 'flame' ? 2 : 1;
      ctx.fillRect(Math.round(e.p.x) - (size >> 1), Math.round(e.p.y) - (size >> 1), size, size);
    }
  }
  // Each prop's flames, from its look (see `PropLook.flame`)
  ctx.fillStyle = C.flame;
  for (const p of propsOf(f)) {
    if (hasFlame(p) && fog.known(p.x, p.z)) {
      ctx.fillStyle = C.flame;
      drawPropFlame(ctx, p, s.iso(p.x, p.z), f.time);
    }
  }
}

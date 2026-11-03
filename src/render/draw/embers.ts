import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import type { Scene } from './scene';

// The turn between each ember of a patch, so they spread evenly over it
const GOLDEN_TURN = Math.PI * (3 - Math.sqrt(5));

// Embers flicker on their charred ground, red and gold, shining through
// the dark.
export default function drawEmbers(s: Scene, f: Frame, fog: Fogs): void {
  const { ctx } = s;
  for (const p of f.areas.flatMap((a) => a.stage.patches ?? [])) {
    if (p.kind !== 'embers' || !fog.known(p.x, p.z)) {
      continue;
    }
    const n = Math.round(p.r * 10);
    for (let i = 0; i < n; i++) {
      // Fixed places in the patch, each lit on its own beat
      const a = i * GOLDEN_TURN;
      const d = p.r * 0.85 * Math.sqrt((i + 0.5) / n);
      const glow = Math.sin(f.time * (2 + (i % 3)) + i * 1.7);
      if (glow < -0.2) {
        continue;
      }
      const b = s.iso(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d);
      const size = glow > 0.6 ? 2 : 1;
      ctx.fillStyle = glow > 0.6 ? C.flame : C.blood;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), size, size);
    }
  }
}

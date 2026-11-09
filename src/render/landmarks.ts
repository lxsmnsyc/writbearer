import type { Ahead } from '../gen/stage';
import type { Scene } from './draw/scene';
import { C } from './palette';
import type { Frame } from './renderer';

/** What shows over the horizon beyond a road. */
export type Landmark = 'smoke' | 'lights' | 'glow' | 'sparks' | 'embers';

/** How far past an exit's mouth a landmark stands, in tiles. */
export const LANDMARK_DISTANCE = 10;

// Only the kind of the area ahead decides it. A plain fight and the way down
// show nothing, and a fight that hides as a Camp is a Camp here too, because
// its `ahead` says so.
export const LANDMARKS: Record<Ahead, Landmark | null> = {
  combat: null,
  down: null,
  camp: 'smoke',
  town: 'lights',
  elite: 'glow',
  event: 'sparks',
  boss: 'embers',
};

/** The landmark for what lies ahead of an exit, if any. */
export function landmarkOf(ahead: Ahead): Landmark | null {
  return LANDMARKS[ahead];
}

// Drawn after the dark so it shows through the fog, at a spot beyond each
// open road. Reads `exit.ahead` only: the next area does not exist yet.
export default function drawLandmarks(s: Scene, f: Frame): void {
  const { ctx } = s;
  for (const e of f.areas.flatMap((a) => a.stage.exits)) {
    const kind = landmarkOf(e.ahead);
    if (kind === null || e.closed === true || e.taken === true) {
      continue;
    }
    const at = s.iso(e.x + e.out.x * LANDMARK_DISTANCE, e.z + e.out.z * LANDMARK_DISTANCE);
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    const t = f.time;
    const seed = e.x * 7 + e.z * 13;
    if (kind === 'smoke') {
      // A grey column that drifts up and thins
      ctx.fillStyle = C.cloth;
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.25 + i / 4) % 1;
        const w = 2 + Math.round(k * 3);
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.fillRect(
          Math.round(x + Math.sin(seed + k * 4) * 2) - (w >> 1),
          Math.round(y - k * 24),
          w,
          w,
        );
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.flame;
      ctx.fillRect(x, y, 2, 2);
    } else if (kind === 'lights') {
      // A scatter of steady windows
      ctx.fillStyle = C.flame;
      for (let i = 0; i < 5; i++) {
        const dx = ((i * 5 + Math.round(seed)) % 13) - 6;
        const dy = ((i * 3 + Math.round(seed)) % 5) - 2;
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2 + i);
        ctx.fillRect(x + dx, y + dy, 1, 2);
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'glow') {
      // A red glow on the horizon that breathes
      ctx.fillStyle = C.blood;
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 2);
      ctx.fillRect(x - 6, y - 2, 12, 4);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x - 3, y - 1, 6, 2);
      ctx.globalAlpha = 1;
    } else if (kind === 'sparks') {
      // A lone teal flicker: someone on the road
      ctx.fillStyle = C.teal;
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + seed));
      ctx.fillRect(x, y, 2, 2);
      ctx.globalAlpha = 1;
    } else {
      // The ring's embers, rising from a dark crown
      ctx.fillStyle = C.blood;
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.4 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillRect(x + (i - 1) * 4, Math.round(y - k * 14), 1, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}

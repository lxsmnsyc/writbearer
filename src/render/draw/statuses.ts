import {
  BLEED,
  BURN,
  CHILL,
  DREAD,
  FREEZE,
  PETRIFY,
  POISON,
  ROOTED,
  SEAR,
  SHIELD_WALL,
  SHOCK,
  SLOWED,
  STUN,
  SUNDERED,
  TAUNTED,
  WADING,
} from '../../sim/statuses';
import type Unit from '../../sim/unit';
import { C } from '../palette';
import { look } from '../rig';
import { barHeight } from './figures';
import type { Scene } from './scene';

/** Each status's color: its element's, or bone for plain ones like Stun. */
export const STATUS_COLOR: Record<string, string> = {
  [TAUNTED.id]: C.blood,
  [STUN.id]: C.bone,
  [BURN.id]: C.flame,
  [CHILL.id]: C.frost,
  [FREEZE.id]: C.frost,
  [SHOCK.id]: C.storm,
  [PETRIFY.id]: C.earth,
  [POISON.id]: C.venom,
  [DREAD.id]: C.teal,
  [ROOTED.id]: C.bone,
  [SEAR.id]: C.flame,
  [BLEED.id]: C.blood,
  [SLOWED.id]: C.bone,
  [WADING.id]: C.frost,
  [SHIELD_WALL.id]: C.gold,
};

/** Statuses that build up, by id, to read their thresholds. */
export const BUILDUP_STATUS = new Map(
  [STUN, BURN, CHILL, SHOCK, PETRIFY, POISON, DREAD, SEAR].map((def) => [def.id, def]),
);

// Marks for each status, in its element's color. They shine through the dark.
export function drawStatuses(s: Scene, u: Unit, x: number, z: number, time: number): void {
  const { ctx } = s;
  const b = s.body(x, z);
  const top = b.y - Math.round((barHeight(u) + 5) * look.zoom);
  for (const st of u.statuses.values()) {
    const color = STATUS_COLOR[st.def.id] ?? C.bone;
    ctx.fillStyle = color;
    if (st.def.id === TAUNTED.id) {
      // A red notch over the head: this one has turned on the Vanguard.
      ctx.fillRect(b.x - 1, top - 3, 2, 3);
      ctx.fillRect(b.x - 1, top + 1, 2, 1);
    } else if (st.def.disables) {
      // Three motes circling the head.
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + (i * Math.PI * 2) / 3;
        ctx.fillRect(
          Math.round(b.x + Math.cos(a) * 5),
          Math.round(top + 4 + Math.sin(a) * 2),
          1,
          1,
        );
      }
    } else if (st.def.id === SUNDERED.id) {
      // Broken armor shows in the stats, not over the head.
      continue;
    } else if (st.def.slow === undefined) {
      // Embers or bubbles rise off the body.
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.9 + i / 3) % 1;
        const px = b.x + Math.round(Math.sin(i * 2.3 + time) * 4);
        const py = Math.round(b.y - (8 + t * (barHeight(u) - 6)) * look.zoom);
        ctx.fillRect(px, py, 1, 1);
      }
    } else {
      // Frost settles at the feet, or the snare's jaws close on them.
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(b.x - 5 + i * 3, b.y + (i % 2), 1, 1);
      }
    }
  }
}

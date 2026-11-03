// The bearer's shouts: their keys, Focus on the enemy under the mouse, and
// the callout over the bearer's head.
import { Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import { ALL_SHOUTS, SHOUTS, Shout, cooldownLeft, cry } from '../../sim/shout';
import type GameState from './state';

// The key for each shout, and how near the mouse an enemy must be to Focus it
export const SHOUT_KEY: Record<Shout, string> = {
  [Shout.Rally]: 'z',
  [Shout.FallBack]: 'x',
  [Shout.Hold]: 'c',
  [Shout.Focus]: 'f',
};
const FOCUS_REACH = 1.5;
// Seconds a shout shows over the bearer's head
const CALLOUT_TIME = 1.2;

// The enemy in sight nearest the mouse, within a tile and a half of it.
function enemyAtPointer(g: GameState): Unit | null {
  if (!g.pointer) {
    return null;
  }
  const p = g.renderer.unproject(g.pointer.x, g.pointer.y);
  let best: Unit | null = null;
  let bestD = FOCUS_REACH;
  for (const m of g.sim.living(Side.Monster)) {
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (d < bestD && g.renderer.sees(m.x, m.z)) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/**
 * The bearer shouts. Focus marks the enemy under the mouse. Returns why it
 * could not, or null.
 */
export function shout(g: GameState, which: Shout): string | null {
  if (g.over || g.paused) {
    return null;
  }
  const why = cry(g.sim, which, which === Shout.Focus ? enemyAtPointer(g) : null);
  if (why) {
    g.say(why);
    return why;
  }
  g.callout = { text: `${SHOUTS[which].name}!`, until: g.time + CALLOUT_TIME };
  g.effects.shout(g.bearer);
  return null;
}

/** Each shout's key, name and seconds until it is ready again. */
export function shoutBar(
  g: GameState,
): { shout: Shout; key: string; name: string; left: number; cooldown: number }[] {
  return ALL_SHOUTS.map((s) => ({
    shout: s,
    key: SHOUT_KEY[s],
    name: SHOUTS[s].name,
    left: cooldownLeft(g.sim, s),
    cooldown: SHOUTS[s].cooldown,
  }));
}

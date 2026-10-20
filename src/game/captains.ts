import { MONSTERS, type MonsterKind, spawnMonster } from '../content/roster';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';
import { warn } from '../sim/warning';

// Captains at work. Once a captain is in the fight, it calls more of its
// pack on a beat, up to a few times. Where they will come is shown on the
// ground first. Killing the captain stops the calls, so it is the one to go
// for.

/** Seconds from a captain waking to its first call, and between calls. */
export const FIRST_CALL = 4;
export const CALL_EVERY = 12;
/** How many times a captain calls. */
export const CALLS = 3;
// How far behind the captain its followers come, away from the bearer, and
// how long the ground warns of them first
const BEHIND = 4;
const ARRIVE = { r: 1.6, windup: 1.2 };
// How far apart the followers come, as a ring
const SPREAD = 0.8;

const isMonsterKind = (k: string): k is MonsterKind => k in MONSTERS;

export default class Captains {
  // Seconds each captain has been in the fight, and how many times it has called
  private readonly woke = new WeakMap<Unit, { t: number; called: number }>();

  /** Works every captain in the fight. Returns those that called now. */
  update(sim: Sim, dt: number): Unit[] {
    const called: Unit[] = [];
    for (const u of sim.living(Side.Monster)) {
      if (u.calls.length === 0 || !u.aware) {
        continue;
      }
      const w = this.woke.get(u) ?? { t: 0, called: 0 };
      this.woke.set(u, w);
      w.t += dt;
      if (w.called >= CALLS || w.t < FIRST_CALL + w.called * CALL_EVERY) {
        continue;
      }
      w.called++;
      call(sim, u);
      called.push(u);
    }
    return called;
  }
}

// Shows where a captain's followers will come, behind it, then brings them
// there, already in the fight. None come if it dies first.
function call(sim: Sim, captain: Unit): void {
  const from = sim.bearer ?? captain;
  const d = Math.hypot(captain.x - from.x, captain.z - from.z) || 1;
  const want = {
    x: captain.x + ((captain.x - from.x) / d) * BEHIND,
    z: captain.z + ((captain.z - from.z) / d) * BEHIND,
  };
  const at = sim.nav?.free(want.x, want.z) ?? want;
  warn(sim, {
    ...at,
    shape: { kind: 'circle', r: ARRIVE.r },
    windup: ARRIVE.windup,
    spare: null,
    source: captain,
    strike: () => undefined,
    done: () => {
      captain.calls.filter(isMonsterKind).forEach((kind, i) => {
        const a = (i / captain.calls.length) * Math.PI * 2;
        const r = i === 0 ? 0 : SPREAD;
        const m = spawnMonster(
          sim,
          kind,
          captain.level,
          at.x + Math.cos(a) * r,
          at.z + Math.sin(a) * r,
        );
        m.aware = true;
      });
    },
  });
}

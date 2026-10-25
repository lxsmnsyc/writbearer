import { type MonsterKind, spawnMonster } from '../content/roster';
import type { Spot } from '../sim/nav';
import { ALARM_REACH } from '../sim/ai';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';
import { warn } from '../sim/warning';
import type { Pace } from './objective';

// Alarms, from the stages design: horn posts on the field, and the
// Horn-Bearers who run for them. Once its pack wakes, a Horn-Bearer runs
// for the nearest post still standing. If it gets there, it blows the horn,
// and a fresh pack marches in, shown on the ground first. Killing it on the
// way, or breaking the post first, stops it. A Horn-Bearer blows once; the
// Horn of the Road, a mini-boss, runs on to the next post and blows again.

// How long the ground shows where a called pack comes, and how often the
// Horn of the Road may blow
const CALL_WARNING = 3;
const BLOW_AGAIN = 15;
// The pack a horn calls where the area has none of its own
const FALLBACK_PACK: MonsterKind[] = ['hollowSoldier', 'husk', 'husk', 'husk'];

export default class Alarms {
  // Heralds that have blown, and when a named one may blow again, and at
  // which post it last blew
  private readonly blown = new WeakSet<Unit>();
  private readonly again = new WeakMap<Unit, { wait: number; post: Unit }>();

  /**
   * Sends each awake Horn-Bearer for its post, and blows the horn of each
   * that got there. Returns how many horns were blown now.
   */
  update(
    sim: Sim,
    dt: number,
    level: number,
    pack: readonly MonsterKind[] | undefined,
    pace: Pace | null,
  ): number {
    const posts = sim.living(Side.Monster).filter((u) => u.kind === 'hornPost');
    let blew = 0;
    for (const u of sim.living(Side.Monster)) {
      if (u.kind !== 'hornBearer' || !u.aware || this.blown.has(u)) {
        u.alarm = null;
        continue;
      }
      const again = this.again.get(u);
      if (again && again.wait > 0) {
        again.wait -= dt;
        u.alarm = null;
        continue;
      }
      const post = posts
        .filter((p) => p !== again?.post || posts.length === 1)
        .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
        .at(0);
      if (!post) {
        u.alarm = null;
        continue;
      }
      u.alarm = { x: post.x, z: post.z };
      if (u.distanceTo(post) > ALARM_REACH + 0.3) {
        continue;
      }
      u.alarm = null;
      blew++;
      if (u.named) {
        this.again.set(u, { wait: BLOW_AGAIN, post });
      } else {
        this.blown.add(u);
      }
      call(sim, post, level, pack && pack.length > 0 ? pack : FALLBACK_PACK, pace);
    }
    return blew;
  }
}

// A fresh pack marches in, from where the director chooses or near the
// post, shown on the ground first, and rushes the party.
function call(
  sim: Sim,
  post: Spot,
  level: number,
  kinds: readonly MonsterKind[],
  pace: Pace | null,
): void {
  const from = pace?.spawnAt(post) ?? post;
  warn(sim, {
    x: from.x,
    z: from.z,
    shape: { kind: 'circle', r: 2 },
    windup: CALL_WARNING,
    spare: Side.Party,
    strike: () => undefined,
    source: null,
    done: () => {
      kinds.forEach((kind, i) => {
        const a = (i / kinds.length) * Math.PI * 2;
        const m = spawnMonster(sim, kind, level, from.x + Math.cos(a), from.z + Math.sin(a));
        m.aware = true;
        const bearer = sim.bearer;
        m.lastSeen = bearer ? { x: bearer.x, z: bearer.z } : null;
      });
    },
  });
}

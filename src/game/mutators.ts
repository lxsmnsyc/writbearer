import { spawnMonster } from '../content/roster';
import type { Mutator } from '../gen/graph';
import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { DamageFlags, DamageKind, DamagePriority, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { warn } from '../sim/warning';

// A fight's mutators at work, from the gauntlets design.
//
// - Darkness halves how far the party sees. The renderer reads it.
// - Blood moon: a monster below half health deals more damage.
// - Volatile: a monster bursts where it dies, shown on the ground first.
// - Restless dead: a body not torn apart rises as a Husk after a while,
//   the party's dead too, unless a Respite keeps them.

const BLOOD_MOON_AT = 0.5;
const BLOOD_MOON_FACTOR = 1.3;
export const BURST = { r: 1.6, windup: 1, share: 0.15 };
export const RISE_AFTER = 10;

export default class MutatorRun {
  private active = new Set<Mutator>();
  // The dead who will rise, and how long each has lain
  private readonly lying = new Map<Unit, number>();
  // Husks that rose, which do not rise again
  private readonly risen = new WeakSet<Unit>();

  constructor(
    private readonly sim: Sim,
    private readonly level: () => number,
  ) {
    sim.on(SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      const u = event.source;
      if (
        this.has('bloodMoon') &&
        u.side === Side.Monster &&
        u.hp < u.derived.maxHp * BLOOD_MOON_AT &&
        event.target.side !== Side.Monster
      ) {
        event.value *= BLOOD_MOON_FACTOR;
      }
    });
    sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      const u = event.source;
      if (u.side === Side.Monster && this.has('volatile')) {
        this.burst(u);
      }
      const spared = u.side === Side.Party && sim.spared;
      if (this.has('restless') && !u.torn && !spared && !this.risen.has(u) && u !== sim.bearer) {
        this.lying.set(u, 0);
      }
    });
  }

  /** Sets the mutators of the area the party is in. */
  set(list: readonly Mutator[]): void {
    this.active = new Set(list);
    this.lying.clear();
  }

  has(m: Mutator): boolean {
    return this.active.has(m);
  }

  /** The dead rise once they have lain long enough. */
  update(dt: number): void {
    for (const [u, t] of this.lying) {
      if (u.alive || u.torn) {
        this.lying.delete(u);
        continue;
      }
      if (t + dt < RISE_AFTER) {
        this.lying.set(u, t + dt);
        continue;
      }
      this.lying.delete(u);
      // The body walks off as a Husk, and nothing is left to raise.
      u.torn = true;
      const husk = spawnMonster(this.sim, 'husk', this.level(), u.x, u.z);
      husk.aware = true;
      this.risen.add(husk);
    }
  }

  // A burst where a monster died, that hurts the party after a moment.
  private burst(u: Unit): void {
    warn(this.sim, {
      x: u.x,
      z: u.z,
      shape: { kind: 'circle', r: BURST.r },
      windup: BURST.windup,
      spare: Side.Monster,
      source: null,
      strike: (v) => {
        v.hit(v, {
          kind: DamageKind.True,
          fixed: Math.max(1, Math.round(v.derived.maxHp * BURST.share)),
          flags: DamageFlags.Redirected,
        });
      },
    });
  }
}

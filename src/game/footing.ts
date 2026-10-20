import type { Patch, Prop, Stage } from '../gen/stage';
import { WADING } from '../sim/statuses';
import type Sim from '../sim/sim';
import { DamageFlags, DamageKind, Side } from '../sim/types';
import type Unit from '../sim/unit';

// What the ground of an open field does to whoever stands on it, party and
// monsters alike. Shallow water slows. Embers burn a share of health each
// second. A blossom bursts when one of the party walks into it, and mends
// the party around it.

// The share of health embers burn each second
const EMBERS_SHARE = 0.04;
// How near one of the party comes to burst a blossom, how far its burst
// reaches, and the share of health it mends
const BLOSSOM_TOUCH = 0.9;
export const BLOSSOM_REACH = 4;
const BLOSSOM_SHARE = 0.3;

const inPatch = (p: Patch, u: Unit): boolean => Math.hypot(u.x - p.x, u.z - p.z) <= p.r;

export default class Footing {
  // How long each unit has stood in embers since it last burned
  private readonly burning = new WeakMap<Unit, number>();

  /** Works the ground of the areas standing. Returns the blossoms that burst. */
  update(sim: Sim, dt: number, stages: readonly Stage[]): Prop[] {
    const patches = stages.flatMap((s) => s.patches ?? []);
    for (const u of sim.living()) {
      let embers = false;
      for (const p of patches) {
        if (!inPatch(p, u)) {
          continue;
        }
        if (p.kind === 'water') {
          u.addStatus(WADING, u);
        } else {
          embers = true;
        }
      }
      this.burn(u, embers, dt);
    }
    const burst: Prop[] = [];
    const party = sim.living(Side.Party);
    for (const b of stages.flatMap((s) => s.props)) {
      if (b.kind !== 'blossom' || b.open === true) {
        continue;
      }
      const by = party.find((u) => Math.hypot(u.x - b.x, u.z - b.z) <= BLOSSOM_TOUCH);
      if (!by) {
        continue;
      }
      b.open = true;
      burst.push(b);
      for (const m of party) {
        if (Math.hypot(m.x - b.x, m.z - b.z) <= BLOSSOM_REACH) {
          by.heal(m, m.derived.maxHp * BLOSSOM_SHARE);
        }
      }
    }
    return burst;
  }

  // Embers burn once for each second stood in them.
  private burn(u: Unit, embers: boolean, dt: number): void {
    if (!embers) {
      this.burning.delete(u);
      return;
    }
    const stood = (this.burning.get(u) ?? 0) + dt;
    if (stood < 1) {
      this.burning.set(u, stood);
      return;
    }
    this.burning.set(u, stood - 1);
    u.hit(u, {
      kind: DamageKind.True,
      fixed: Math.max(1, Math.round(u.derived.maxHp * EMBERS_SHARE)),
      flags: DamageFlags.Redirected,
    });
  }
}

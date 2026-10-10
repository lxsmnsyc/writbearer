import type Sim from '../sim/sim';
import type Unit from '../sim/unit';
import { HIT_FRACTION, type Kind, type RigUnit, isKind } from './rig';

// Matches the simulation's recovery after a blow.
const RECOVERY = 0.2;

/**
 * What the renderer remembers about a unit between frames: where it was on
 * the last tick, its smoothed facing and its walk cycle.
 */
export interface View {
  // Positions at the last two ticks, for drawing between them
  px: number;
  pz: number;
  x: number;
  z: number;
  angle: number;
  walk: number;
  stride: number;
  moving: boolean;
  // Seconds since the unit was last hit
  hurt: number;
}

export class Views {
  private readonly views = new Map<Unit, View>();

  get(u: Unit): View {
    let v = this.views.get(u);
    if (!v) {
      v = {
        px: u.x,
        pz: u.z,
        x: u.x,
        z: u.z,
        angle: u.angle,
        walk: 0,
        stride: 0,
        moving: false,
        hurt: 9,
      };
      this.views.set(u, v);
    }
    return v;
  }

  /** Records where each unit ended the tick. */
  afterTick(sim: Sim): void {
    for (const u of sim.units) {
      const v = this.get(u);
      const moved = Math.hypot(u.x - v.x, u.z - v.z);
      v.px = v.x;
      v.pz = v.z;
      v.x = u.x;
      v.z = u.z;
      v.moving = moved > 0.001;
      // The walk cycle follows distance, so feet do not slide.
      v.walk += moved * 5.2;
    }
  }

  /** Eases facing and stride every frame. */
  frame(sim: Sim, dt: number): void {
    for (const u of sim.units) {
      const v = this.get(u);
      v.hurt += dt;
      let d = u.angle - v.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.angle += Math.sign(d) * Math.min(Math.abs(d), 10 * dt);
      v.stride += ((v.moving ? 1 : 0) - v.stride) * Math.min(1, dt * 10);
    }
  }

  hit(u: Unit): void {
    this.get(u).hurt = 0;
  }

  /** The rig's view of a unit, `alpha` of the way from the last tick to this one. */
  rig(u: Unit, alpha: number): RigUnit {
    const v = this.get(u);
    const { kind } = u;
    if (!isKind(kind)) {
      throw new Error(`No figure for unit kind "${kind}"`);
    }
    return {
      kind,
      x: v.px + (v.x - v.px) * alpha,
      z: v.pz + (v.z - v.pz) * alpha,
      angle: v.angle,
      walk: v.walk,
      stride: v.stride,
      atk: attackProgress(u, kind),
      hurt: v.hurt,
      alert: u.target?.alive === true,
    };
  }
}

// Maps the simulation's swing time onto the rig's 0 to 1 attack, so the
// drawn blow lands on the same frame as the damage.
function attackProgress(u: Unit, kind: Kind): number {
  if (u.swing < 0) {
    return -1;
  }
  const h = HIT_FRACTION[kind];
  if (u.swing < u.kit.hitAt) {
    return (u.swing / u.kit.hitAt) * h;
  }
  return Math.min(1, h + ((u.swing - u.kit.hitAt) / RECOVERY) * (1 - h));
}

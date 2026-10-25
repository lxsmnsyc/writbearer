import type Sim from '../sim/sim';
import { EquipSlot, ItemType } from '../sim/item';
import { Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { HIT_FRACTION, type Kind, type RigUnit, isKind } from './rig';

// Matches the simulation's recovery after a blow.
const RECOVERY = 0.2;
// Seconds a body takes to fall when it dies.
const FALL_TIME = 0.7;
// Skills drawn as a shout: the Vanguard bangs its shield.
const SHOUTS = new Set(['challenge']);

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
  // A drawn push back from the last hit, in tiles. It eases out.
  kx: number;
  kz: number;
  // Seconds since death, or -1 while alive
  dead: number;
}

// Bosses drawn as a larger figure of their kind.
const FIGURE: Partial<Record<string, { kind: Kind; size: number }>> = {
  gatekeeper: { kind: 'hollowSoldier', size: 1.8 },
  abbess: { kind: 'cantor', size: 1.5 },
  hollowedSaint: { kind: 'hollowed', size: 1.6 },
  // The bearer, grown into what it carried
  creditor: { kind: 'bearer', size: 1.9 },
};

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
        kx: 0,
        kz: 0,
        dead: -1,
      };
      this.views.set(u, v);
    }
    return v;
  }

  /** Forgets where units were, after they were moved to a new stage. */
  snap(sim: Sim): void {
    for (const u of sim.units) {
      const v = this.get(u);
      v.px = u.x;
      v.pz = u.z;
      v.x = u.x;
      v.z = u.z;
      v.kx = 0;
      v.kz = 0;
    }
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
      if (!u.alive) {
        v.dead = Math.max(0, v.dead) + dt;
        v.stride = 0;
        continue;
      }
      v.dead = -1;
      let d = u.angle - v.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.angle += Math.sign(d) * Math.min(Math.abs(d), 10 * dt);
      v.stride += ((v.moving ? 1 : 0) - v.stride) * Math.min(1, dt * 10);
      const ease = Math.max(0, 1 - dt * 10);
      v.kx *= ease;
      v.kz *= ease;
    }
  }

  hit(u: Unit): void {
    this.get(u).hurt = 0;
  }

  knock(u: Unit, dx: number, dz: number): void {
    const v = this.get(u);
    v.kx = dx;
    v.kz = dz;
  }

  /** The rig's view of a unit, `alpha` of the way from the last tick to this one. */
  rig(u: Unit, alpha: number): RigUnit {
    const v = this.get(u);
    const figure = FIGURE[u.kind];
    const kind = figure?.kind ?? u.kind;
    if (!isKind(kind)) {
      throw new Error(`No figure for unit kind "${kind}"`);
    }
    return {
      kind,
      size: figure?.size,
      x: v.px + (v.x - v.px) * alpha + v.kx,
      z: v.pz + (v.z - v.pz) * alpha + v.kz,
      angle: v.angle,
      walk: v.walk,
      stride: v.stride,
      atk: u.alive ? attackProgress(u, kind) : -1,
      shout: u.alive ? shoutProgress(u) : -1,
      fall: v.dead < 0 ? -1 : Math.min(1, v.dead / FALL_TIME),
      hurt: v.hurt,
      alert: u.alive && u.target?.alive === true,
      elite: u.rank !== Rank.Normal,
      named: u.named,
      held: u.side === Side.Party ? held(u) : undefined,
    };
  }
}

// Maps the simulation's swing time onto the rig's 0 to 1 attack, so the
// drawn blow lands on the same frame as the damage.
// A skill with no pose of its own is drawn as a slower basic attack.
function attackProgress(u: Unit, kind: Kind): number {
  const h = HIT_FRACTION[kind];
  if (u.cast && !SHOUTS.has(u.cast.skill.id)) {
    return progress(u.cast.t, u.cast.skill.windup, u.cast.skill.recovery, h);
  }
  if (u.swing < 0) {
    return -1;
  }
  return progress(u.swing, u.kit.hitAt, RECOVERY, h);
}

// A shout's progress from 0 to 1. It lands at the middle.
function shoutProgress(u: Unit): number {
  if (!u.cast || !SHOUTS.has(u.cast.skill.id)) {
    return -1;
  }
  return progress(u.cast.t, u.cast.skill.windup, u.cast.skill.recovery, 0.5);
}

// Maps time in a windup and recovery onto 0 to 1, with the release at `at`.
function progress(t: number, windup: number, recovery: number, at: number): number {
  if (t < windup) {
    return (t / windup) * at;
  }
  return Math.min(1, at + ((t - windup) / recovery) * (1 - at));
}

// What a merc's figure shows of its gear.
function held(u: Unit): NonNullable<RigUnit['held']> {
  return {
    weapon: u.equipment.get(EquipSlot.Weapon)?.base.weapon ?? null,
    shield: u.equipment.get(EquipSlot.Offhand)?.base.type === ItemType.Shield,
  };
}

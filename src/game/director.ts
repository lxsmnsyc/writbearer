import { EventPriority } from '../core/event-emitter';
import type RNG from '../core/rng';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { DamagePriority, Side } from '../sim/types';
import type Unit from '../sim/unit';

// The level director, from the director design, after Left 4 Dead's. It
// reads how the party is doing and paces the gauntlet to match.
//
// - Intensity, for pacing: each party member's rises as it is hurt, as
//   mercs fall and as monsters die near it, and decays while nothing is
//   engaging it. The director paces by the highest, the bearer's doubled.
// - Phases: build up until intensity peaks, sustain the peak a few
//   seconds, let it fade, then relax for a while or until the party has
//   moved on, and build up again.
// - Standing, for difficulty: one number for the run, from -1 for a party
//   that is struggling to 1 for one winning easily, moved at the end of
//   each area's objective.
//
// So far it only reads and keeps its phase. Nothing it decides spawns yet.

export type Phase = 'buildUp' | 'sustainPeak' | 'peakFade' | 'relax';

export const PHASE_NAME: Record<Phase, string> = {
  buildUp: 'Build up',
  sustainPeak: 'Sustain peak',
  peakFade: 'Peak fade',
  relax: 'Relax',
};

// How much intensity a hit adds, as a multiple of the share of health it
// took; a merc falling adds to everyone left; a monster dying adds to those
// near it, less the farther away.
const HIT_GAIN = 1.2;
const FALL_GAIN = 0.4;
const KILL_GAIN = 0.06;
const KILL_REACH = 6;
// How fast intensity decays each second, while nothing is engaging
const DECAY = 0.05;
// The bearer's intensity counts double: losing it ends the run.
const BEARER_WEIGHT = 2;
/** Where intensity peaks. */
export const PEAK = 0.75;
// How long the peak is sustained, and the relax after it, in seconds, and
// how far the bearer walks to end the relax early
const SUSTAIN: [number, number] = [3, 5];
const RELAX: [number, number] = [30, 45];
const RELAX_TRAVEL = 25;
// How much of the standing each area moves
const STANDING_STEP = 0.4;

/** What the game tells the director of an area once its objective is done. */
export interface AreaReport {
  // Health of the living party, as a share of their maximum
  health: number;
  // Potions left, in the pack and on the belts
  potions: number;
  // Seconds the objective usually takes, if it has a usual time
  usual: number;
  // Whether the bonus challenge was met, failed, or there was none
  bonus: boolean | null;
  // The mercs' mean level against what is expected at this depth
  levelAhead: number;
}

/** What one area said of the party, each part from -1 to 1. */
export interface AreaScore {
  health: number;
  losses: number;
  potions: number;
  pace: number | null;
  bonus: number | null;
  strength: number;
  score: number;
}

const clamp = (v: number, lo = -1, hi = 1): number => Math.max(lo, Math.min(hi, v));

// A bonus met counts for the party, one failed a little against it.
function bonusPart(met: boolean | null): number | null {
  if (met === null) {
    return null;
  }
  return met ? 0.5 : -0.25;
}

/** How an area went, from -1 for a struggle to 1 for an easy win. */
export function scoreArea(report: AreaReport, losses: number, took: number): AreaScore {
  const parts = {
    health: clamp((report.health - 0.6) / 0.4),
    losses: clamp(-0.5 * losses),
    potions: clamp((report.potions - 4) / 4),
    pace: Number.isFinite(report.usual) ? clamp((report.usual - took) / report.usual) : null,
    bonus: bonusPart(report.bonus),
    strength: clamp(report.levelAhead / 3),
  };
  const known = Object.values(parts).filter((v) => v !== null);
  return { ...parts, score: known.reduce((n, v) => n + v, 0) / known.length };
}

export default class Director {
  phase: Phase = 'buildUp';
  // Seconds left in a timed phase
  private left = 0;
  // Where the bearer was as the relax began
  private relaxFrom: { x: number; z: number } | null = null;
  private readonly intensity = new Map<Unit, number>();
  // This area so far: how long it has taken and the mercs lost in it
  private took = 0;
  private losses = 0;
  /** The party's standing over the run, from -1 to 1. */
  standing = 0;
  /** What the last area said of the party. */
  last: AreaScore | null = null;

  constructor(
    private readonly sim: Sim,
    private readonly rng: RNG,
  ) {
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (e) => {
      const u = e.target;
      if (u.side !== Side.Party || e.value <= 0) {
        return;
      }
      this.raise(u, (HIT_GAIN * e.value) / Math.max(1, u.derived.maxHp));
    });
    sim.on(SimEvents.UnitDies, EventPriority.Post, (e) => {
      const dead = e.source;
      const party = sim.living(Side.Party);
      if (dead.side === Side.Party) {
        if (dead !== sim.bearer) {
          this.losses++;
        }
        for (const u of party) {
          this.raise(u, FALL_GAIN);
        }
        this.intensity.delete(dead);
        return;
      }
      if (dead.side !== Side.Monster) {
        return;
      }
      for (const u of party) {
        const d = u.distanceTo(dead);
        if (d < KILL_REACH) {
          this.raise(u, KILL_GAIN * (1 - d / KILL_REACH));
        }
      }
    });
  }

  private raise(u: Unit, by: number): void {
    this.intensity.set(u, clamp((this.intensity.get(u) ?? 0) + by, 0, 1));
  }

  /** A party member's intensity, from 0 to 1. */
  intensityOf(u: Unit): number {
    return this.intensity.get(u) ?? 0;
  }

  /** The intensity the director paces by: the party's highest, the bearer's doubled. */
  pacing(): number {
    let most = 0;
    for (const u of this.sim.living(Side.Party)) {
      const weight = u === this.sim.bearer ? BEARER_WEIGHT : 1;
      most = Math.max(most, this.intensityOf(u) * weight);
    }
    return Math.min(1, most);
  }

  /** Seconds left in the current phase, if it is timed. */
  phaseLeft(): number | null {
    return this.phase === 'sustainPeak' || this.phase === 'relax' ? this.left : null;
  }

  update(dt: number): void {
    this.took += dt;
    // Intensity decays only while no monster is engaging the member.
    const engaged = new Set<Unit>();
    for (const m of this.sim.living(Side.Monster)) {
      if (m.aware && m.target) {
        engaged.add(m.target);
      }
    }
    for (const [u, v] of this.intensity) {
      if (!u.alive) {
        this.intensity.delete(u);
      } else if (!engaged.has(u)) {
        this.intensity.set(u, Math.max(0, v - DECAY * dt));
      }
    }
    this.step(dt);
  }

  private step(dt: number): void {
    const pacing = this.pacing();
    if (this.phase === 'buildUp') {
      if (pacing >= PEAK) {
        this.phase = 'sustainPeak';
        this.left = this.rng.range(...SUSTAIN);
      }
      return;
    }
    if (this.phase === 'sustainPeak') {
      this.left -= dt;
      if (this.left <= 0) {
        this.phase = 'peakFade';
      }
      return;
    }
    if (this.phase === 'peakFade') {
      if (pacing < PEAK) {
        this.phase = 'relax';
        this.left = this.rng.range(...RELAX);
        const b = this.sim.bearer;
        this.relaxFrom = b ? { x: b.x, z: b.z } : null;
      }
      return;
    }
    this.left -= dt;
    const b = this.sim.bearer;
    const from = this.relaxFrom;
    const travelled = b && from ? Math.hypot(b.x - from.x, b.z - from.z) : 0;
    if (this.left <= 0 || travelled >= RELAX_TRAVEL) {
      this.phase = 'buildUp';
      this.relaxFrom = null;
    }
  }

  /** A new area begins: its time and losses count from now. */
  beginArea(): void {
    this.took = 0;
    this.losses = 0;
  }

  /** An area's objective is done: the standing moves by how it went. */
  endArea(report: AreaReport): AreaScore {
    const s = scoreArea(report, this.losses, this.took);
    this.last = s;
    this.standing = clamp(this.standing * (1 - STANDING_STEP) + s.score * STANDING_STEP);
    return s;
  }
}

import { EventPriority } from '../core/event-emitter';
import type RNG from '../core/rng';
import type { KeyPoint } from '../gen/stage';
import type Flow from '../sim/flow';
import type { Spot } from '../sim/nav';
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
// - Waves: the Horde's wait out the lulls, grow the longer since the last,
//   and come from a spawn spot no one in the party can see, mostly behind
//   it on the area's flow, as Left 4 Dead's mobs do.

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
// A shorter relax where the party holds its ground, as in a Horde, so it
// does not stand idle: in Left 4 Dead a relax also ends once the
// survivors move on, which a party holding ground never does.
const RELAX_HOLDING: [number, number] = [10, 15];
const RELAX_TRAVEL = 25;
// How much of the standing each area moves
const STANDING_STEP = 0.4;
/** How far the standing moves a fight's threat either way, at most. */
export const BOUND = 0.25;
// A wave just after the last is this share of its full size, and full
// after this many seconds
const WAVE_LEAST = 0.6;
const WAVE_GROW = 30;
// Where a wave may come from: out of the party's sight, which reaches this
// far in the dark; no nearer any of it than this, nor farther from the
// bearer than this; from behind this often; and not from the last few used
const SIGHT = 9;
const SPAWN_NEAR = 8;
const SPAWN_FAR = 30;
const FROM_BEHIND = 0.75;
const RECENT = 2;
// Relief after a hard stretch: how likely, at a standing of 0, and how much
// less likely for a party doing well; how near the bearer it may grow; and
// at most how many in an area
const RELIEF_CHANCE = 0.5;
const RELIEF_LEAST = 0.15;
const RELIEF_REACH = 20;
const RELIEF_MOST = 2;

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

/** The share of its full size a wave has, so many seconds after the last. */
export function waveShare(since: number): number {
  return WAVE_LEAST + (1 - WAVE_LEAST) * Math.min(1, Math.max(0, since) / WAVE_GROW);
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
  // The area's spawn spots and flow, and the spots waves came from lately
  private spawns: KeyPoint[] = [];
  // Whether the party holds its ground in this area
  private holding = false;
  private flow: Flow | null = null;
  private readonly recent: Spot[] = [];
  // The area's relief spots, those used, and whether a hard stretch has
  // just ended
  private reliefs: KeyPoint[] = [];
  private relieved = 0;
  private reliefDue = false;

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
        this.left = this.rng.range(...(this.holding ? RELAX_HOLDING : RELAX));
        this.reliefDue = true;
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

  /** A new area begins: its time and losses count from now, and its spawn spots are known. */
  beginArea(spots: readonly KeyPoint[] = [], flow: Flow | null = null, holding = false): void {
    this.holding = holding;
    this.took = 0;
    this.losses = 0;
    this.spawns = spots.filter((s) => s.kind === 'spawn');
    this.reliefs = spots.filter((s) => s.kind === 'relief');
    this.relieved = 0;
    this.reliefDue = false;
    this.flow = flow;
    this.recent.length = 0;
  }

  /**
   * Relief after a hard stretch, as Left 4 Dead places items: once a peak
   * has faded, perhaps a relief spot near the bearer that no one in the
   * party can see, for a blossom to grow at. More likely the worse the
   * party is doing, at most a couple in an area. Null when none.
   */
  takeRelief(): Spot | null {
    if (!this.reliefDue) {
      return null;
    }
    this.reliefDue = false;
    const chance = clamp(RELIEF_CHANCE * (1 - this.standing), RELIEF_LEAST, 1);
    const bearer = this.sim.bearer;
    if (!bearer || this.relieved >= RELIEF_MOST || !this.rng.chance(chance)) {
      return null;
    }
    const party = this.sim.living(Side.Party);
    const open = this.reliefs.filter(
      (p) =>
        bearer.distanceTo(p) <= RELIEF_REACH &&
        party.every((u) => u.distanceTo(p) > SIGHT || !this.sim.sees(u, p)),
    );
    if (open.length === 0) {
      return null;
    }
    const at = this.rng.pick(open);
    this.reliefs.splice(this.reliefs.indexOf(at), 1);
    this.relieved++;
    return at;
  }

  /**
   * How much of its usual threat the next fight holds, from the standing:
   * less for a party that is struggling, more for one winning easily,
   * within the bounds. An Elite fight is never eased.
   */
  scale(elite: boolean): number {
    const s = 1 + BOUND * this.standing;
    return elite ? Math.max(1, s) : s;
  }

  /** Whether the director is in a lull, when no new wave comes. */
  calm(): boolean {
    return this.phase !== 'buildUp';
  }

  /** The share of its full size a wave has, so many seconds after the last. */
  readonly share = waveShare;

  /**
   * Where a wave comes from: a spawn spot no one in the party can see, not
   * too near it nor too far from the bearer, and not one used lately; from
   * behind the party on the flow three times in four. The fallback when
   * none will do.
   */
  spawnAt(fallback: Spot): Spot {
    const party = this.sim.living(Side.Party);
    const bearer = this.sim.bearer;
    if (!bearer || party.length === 0) {
      return fallback;
    }
    const unseen = (p: Spot): boolean =>
      party.every((u) => u.distanceTo(p) > SIGHT || !this.sim.sees(u, p));
    const valid = this.spawns.filter(
      (p) =>
        // Still floor, as a Collapse may have taken it
        this.sim.nav?.walkable(p.x, p.z) !== false &&
        unseen(p) &&
        party.every((u) => u.distanceTo(p) >= SPAWN_NEAR) &&
        bearer.distanceTo(p) <= SPAWN_FAR &&
        !this.recent.some((r) => r.x === p.x && r.z === p.z),
    );
    if (valid.length === 0) {
      return fallback;
    }
    const here = this.flow?.at(bearer) ?? Infinity;
    const behind = valid.filter((p) => (this.flow?.at(p) ?? Infinity) <= here);
    const ahead = valid.filter((p) => !behind.includes(p));
    let pool = valid;
    if (behind.length > 0 && (ahead.length === 0 || this.rng.chance(FROM_BEHIND))) {
      pool = behind;
    } else if (ahead.length > 0) {
      pool = ahead;
    }
    const at = this.rng.pick(pool);
    this.recent.push(at);
    this.recent.splice(0, Math.max(0, this.recent.length - RECENT));
    return at;
  }

  /** An area's objective is done: the standing moves by how it went. */
  endArea(report: AreaReport): AreaScore {
    const s = scoreArea(report, this.losses, this.took);
    this.last = s;
    this.standing = clamp(this.standing * (1 - STANDING_STEP) + s.score * STANDING_STEP);
    return s;
  }
}

import type { Challenge, Objective } from '../gen/graph';
import { type Rect, inRect } from '../sim/nav';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';

// A fight's bonus challenge as it plays out, from the gauntlets design.
//
// - Untouched fails once the bearer takes a hit.
// - No losses fails once a merc dies.
// - Swift fails once the objective takes longer than its time.
// - Thorough is met if no monster in the area is alive when the objective is done.

/** The time a Swift objective must be done in, in seconds. */
export const SWIFT_TIME: Record<Objective, number> = {
  hunt: 150,
  horde: Infinity,
  maze: 120,
  escort: 150,
  vault: 150,
  ritual: 150,
};

export type BonusState = 'open' | 'met' | 'failed';

export default class Bonus {
  private failed = false;
  private time = 0;

  constructor(
    readonly kind: Challenge,
    private readonly objective: Objective,
    private readonly area: Rect,
  ) {}

  /** The bearer took a hit. */
  hurt(): void {
    if (this.kind === 'untouched') {
      this.failed = true;
    }
  }

  /** A merc died. */
  lost(): void {
    if (this.kind === 'noLosses') {
      this.failed = true;
    }
  }

  /** Time passes while the objective is not done. */
  tick(dt: number): void {
    this.time += dt;
    if (this.kind === 'swift' && this.time > SWIFT_TIME[this.objective]) {
      this.failed = true;
    }
  }

  /** Whether it is met, checked once the objective is done. */
  met(sim: Sim): boolean {
    return !this.failed && (this.kind !== 'thorough' || this.left(sim) === 0);
  }

  /** Whether it can still be met. */
  get state(): Exclude<BonusState, 'met'> {
    return this.failed ? 'failed' : 'open';
  }

  /** How it stands, in a line. */
  status(sim: Sim): string {
    if (this.failed) {
      return 'Failed. The reward stays as it is.';
    }
    if (this.kind === 'untouched') {
      return 'The bearer takes no hit.';
    }
    if (this.kind === 'noLosses') {
      return 'No merc dies.';
    }
    if (this.kind === 'swift') {
      return `Done within ${Math.max(0, Math.ceil(SWIFT_TIME[this.objective] - this.time))}s.`;
    }
    return `Every monster slain: ${this.left(sim)} left.`;
  }

  // The monsters still alive in the area
  private left(sim: Sim): number {
    return [...sim.units].filter((u) => u.side === Side.Monster && u.alive && inRect(this.area, u))
      .length;
  }
}

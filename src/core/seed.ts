import RNG, { hashSeed } from './rng';

/**
 * Every subsystem draws from its own stream, so choices in one never change
 * the results of another. Two players on the same seed see the same map.
 */
export const enum Stream {
  Map = 'map',
  Layout = 'layout',
  Loot = 'loot',
  Combat = 'combat',
  Events = 'events',
  Recruits = 'recruits',
  Craft = 'craft',
}

// Crockford base 32: no I, L, O or U, so seeds are easy to read and type.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SEED_LENGTH = 8;

/** A new random seed for a run, such as `7KQ2M9XA`. */
export function randomSeed(): string {
  const bytes = new Uint8Array(SEED_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
}

/**
 * Cleans a seed the player typed. Spaces at the ends are dropped and letters
 * are upper-cased, so `abc` and ` ABC ` are the same run. Any other text works.
 */
export function normalizeSeed(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * The random streams of one run. A phase's stream depends only on the run
 * seed, the phase and the stream name.
 */
export class RunStreams {
  private readonly streams = new Map<string, RNG>();

  constructor(public readonly seed: string) {
    // Normalized on the way in, so callers cannot make two keys for one run.
    this.seed = normalizeSeed(seed);
  }

  get(phase: number, stream: Stream): RNG {
    const key = `${phase}:${stream}`;
    let rng = this.streams.get(key);
    if (!rng) {
      rng = new RNG(hashSeed(this.seed, phase, stream));
      this.streams.set(key, rng);
    }
    return rng;
  }

  /**
   * A fresh stream for one area of a phase, such as a stage. It depends only
   * on the run seed, the phase, the stream name and the area, so an area is
   * the same however the run reached it.
   */
  area(phase: number, stream: Stream, area: number): RNG {
    return new RNG(hashSeed(this.seed, phase, stream, 'area', area));
  }

  /** The state of every stream drawn from so far, for the suspend save. */
  save(): Record<string, number> {
    return Object.fromEntries(Array.from(this.streams, ([key, rng]) => [key, rng.state]));
  }

  static load(seed: string, states: Record<string, number>): RunStreams {
    const run = new RunStreams(seed);
    for (const [key, state] of Object.entries(states)) {
      run.streams.set(key, new RNG(state));
    }
    return run;
  }
}

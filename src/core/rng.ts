/**
 * Hashes any mix of strings and numbers into a 32-bit seed.
 * FNV-1a over the parts, then a final mix so nearby inputs spread apart.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const text = parts.join('\u0000');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A seeded random stream (mulberry32). Its whole state is one 32-bit
 * number, so a save stores a stream as `state` and restores it as is.
 */
export default class RNG {
  constructor(public state: number) {
    this.state = state >>> 0;
  }

  /** A float in [0, 1). */
  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer from `min` to `max`, both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  /** A float from `min` up to `max`. */
  range(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /** True with the given chance, from 0 to 1. */
  chance(p: number): boolean {
    return this.random() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }

  /** Shuffles in place and returns the same array. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

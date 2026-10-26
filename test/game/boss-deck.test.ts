import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { bossHand, generateStage } from '../../src/gen/stage';

const twice = (hand: readonly string[]): boolean => hand.some((c, i) => i > 0 && c === hand[i - 1]);

describe('the boss deck', () => {
  it('never deals a kind twice in a row', () => {
    const rng = new RNG(3);
    for (let i = 0; i < 100; i++) {
      expect(twice(bossHand(rng, 3, 10, false, false))).toBe(false);
      expect(twice(bossHand(rng, 3, 10, true, false))).toBe(false);
    }
  });

  it('deals one elite and the mini-boss, if there is one', () => {
    const rng = new RNG(4);
    const hand = bossHand(rng, 3, 10, true, false);
    expect(hand.filter((c) => c === 'elite')).toHaveLength(1);
    expect(hand.filter((c) => c === 'mini')).toHaveLength(1);
  });

  it('ends an Elite fight on its mini-boss', () => {
    const rng = new RNG(5);
    for (let i = 0; i < 20; i++) {
      expect(bossHand(rng, 3, 10, true, true).at(-1)).toBe('mini');
    }
  });

  it('deals nothing but empty spots in the first areas', () => {
    expect(bossHand(new RNG(6), 3, 0, false, false)).toEqual(['none', 'none', 'none']);
  });

  it('stands an elite’s pack at the spot its card was dealt to', () => {
    const s = generateStage(new RNG(7), 10, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'hunt',
    });
    const spots = (s.spots ?? []).filter((p) => p.kind === 'boss');
    const i = s.bossCards?.indexOf('elite') ?? -1;
    expect(i).toBeGreaterThanOrEqual(0);
    const pack = s.packs.find((p) => p.x === spots[i].x && p.z === spots[i].z);
    expect(pack?.elite).toBeGreaterThanOrEqual(0);
    expect(pack?.affixes?.length).toBeGreaterThan(0);
  });
});

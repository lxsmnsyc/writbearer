import { describe, expect, it } from 'vitest';
import { KINDS } from '../../src/gen/stage/ground';
import Sim from '../../src/sim/sim';

describe('Ground stub', () => {
  it('answers no cover, height 0 and not lit', () => {
    const { ground } = new Sim(1);
    expect(ground.coverAt(3, 4)).toBeNull();
    expect(ground.heightAt(3, 4)).toBe(0);
    expect(ground.litAt(3, 4)).toBe(false);
  });

  it('has a row for each existing ground kind', () => {
    expect(Object.keys(KINDS)).toEqual(['water', 'embers', 'deep', 'grass']);
  });
});

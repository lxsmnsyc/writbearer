import { describe, expect, it } from 'vitest';
import type { Ahead } from '../../src/gen/stage';
import { LANDMARKS, landmarkOf } from '../../src/render/landmarks';

const KINDS: Ahead[] = ['combat', 'elite', 'camp', 'event', 'town', 'boss', 'down'];

describe('landmarks', () => {
  it('maps every Ahead kind', () => {
    for (const k of KINDS) {
      expect(Object.hasOwn(LANDMARKS, k)).toBe(true);
    }
    expect(Object.keys(LANDMARKS).sort()).toEqual([...KINDS].sort());
  });

  it('shows smoke for a Camp, lights for a Town and a glow for an Elite', () => {
    expect(landmarkOf('camp')).toBe('smoke');
    expect(landmarkOf('town')).toBe('lights');
    expect(landmarkOf('elite')).toBe('glow');
  });

  it('shows nothing for a plain fight or the way down', () => {
    expect(landmarkOf('combat')).toBeNull();
    expect(landmarkOf('down')).toBeNull();
  });
});

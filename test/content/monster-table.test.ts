import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../../src/content/roster';

describe('monster table', () => {
  it('keeps its keys in order', () => {
    expect(Object.keys(MONSTERS)).toEqual([
      'hollowSoldier',
      'hollowArcher',
      'penitentSlinger',
      'hollowShieldbearer',
      'hornBearer',
      'hornPost',
      'penitent',
      'cantor',
      'hollowed',
      'husk',
      'mite',
      'crawler',
      'bloat',
      'broodMother',
      'gatekeeper',
      'abbess',
      'hollowedSaint',
      'creditor',
      'ossuaryPriest',
      'titheTaker',
      'confessor',
      'flagellant',
    ]);
  });
});

import { BESTIARY } from '../bestiary';
import { spawnBroodMother } from '../brood';
import { CARD_BY_MONSTER } from '../cards';
import { MONSTERS } from '../roster';
import type { BossDef } from './types';

// The Marches' first boss. Her moves are in `brood.ts`.
const BROOD_MOTHER: BossDef = {
  id: 'broodMother',
  name: 'The Brood Mother',
  layer: 0,
  template: MONSTERS.broodMother,
  spawn: spawnBroodMother,
  card: CARD_BY_MONSTER.broodMother,
  bestiary: BESTIARY.broodMother,
  view: { kind: 'broodMother', size: 1 },
  icon: 'broodMother',
};

export default BROOD_MOTHER;

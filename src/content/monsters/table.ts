import type { Template } from '../jobs';
import OLD_KING from './old-king';
import CHURCH from './church';
import BLIGHT from './blight';
import CREDITOR from './creditor';

// Every monster, in one order. Add a monster to its faction module and list it here.
export const MONSTERS = {
  hollowSoldier: OLD_KING.hollowSoldier,
  hollowArcher: OLD_KING.hollowArcher,
  penitentSlinger: CHURCH.penitentSlinger,
  hollowShieldbearer: OLD_KING.hollowShieldbearer,
  hornBearer: OLD_KING.hornBearer,
  hornPost: OLD_KING.hornPost,
  penitent: CHURCH.penitent,
  cantor: CHURCH.cantor,
  hollowed: CHURCH.hollowed,
  husk: OLD_KING.husk,
  mite: BLIGHT.mite,
  crawler: BLIGHT.crawler,
  bloat: BLIGHT.bloat,
  broodMother: BLIGHT.broodMother,
  gatekeeper: OLD_KING.gatekeeper,
  abbess: CHURCH.abbess,
  hollowedSaint: CHURCH.hollowedSaint,
  creditor: CREDITOR.creditor,
  ossuaryPriest: CHURCH.ossuaryPriest,
  titheTaker: CHURCH.titheTaker,
  confessor: CHURCH.confessor,
  flagellant: CHURCH.flagellant,
} satisfies Record<string, Template>;

export type MonsterKind = keyof typeof MONSTERS;

import { Element, Race } from '../sim/types';
import type { MonsterKind } from './roster';

// What the compendium says of each monster once it is beaten: who it was,
// and how it fights. The lore's truth is in it from the first run, though
// the player only reads it right at the end: each is someone who died
// trying to stop the bearer.

export interface BestiaryEntry {
  // Who it was
  who: string;
  // How it fights
  how: string;
}

export const BESTIARY: Record<MonsterKind, BestiaryEntry> = {
  mite: {
    who: 'A crawler not yet grown. The Blight lays them where the ground is thin over the Hollow.',
    how: 'Quick and frail, in threes. Its bites build up Poison.',
  },
  husk: {
    who: 'One of the Old King’s townsfolk, drowned when he sank the capital. It still walks the road home.',
    how: 'Slow. Shambles at whoever is nearest.',
  },
  crawler: {
    who: 'The Blight grown. It burrows up from below, as if something down there wanted the road closed.',
    how: 'Bites whoever is closest. Its bites build up Poison.',
  },
  hollowSoldier: {
    who: 'A soldier of the Old King’s guard. He was told to hold the road, and he holds it.',
    how: 'Heavily armored. Goes for the bearer, and hits whoever stands in its way.',
  },
  hollowArcher: {
    who: 'An archer of the Old King’s guard. The bowstring rotted long ago; the habit did not.',
    how: 'Shoots from behind its own and steps back from whoever comes close. Barriers stop its arrows.',
  },
  penitentSlinger: {
    who: 'A Penitent who never learned the knife, and slings stones at the bearer instead.',
    how: 'Keeps well back and slings at the bearer. Fragile once reached. Radiant: holy magic does nothing to it.',
  },
  hornBearer: {
    who: 'A soldier of the Old King’s guard who carried the horn. It still answers the call to arms.',
    how: 'When its pack wakes, it runs for the nearest horn post. If it blows the horn, a fresh pack marches in. Kill it on the way.',
  },
  hornPost: {
    who: 'A pole with the guard’s great horn on it, set up along the road to call the watch.',
    how: 'Does nothing by itself. Break it, and no Horn-Bearer can blow it.',
  },
  penitent: {
    who: 'A Penitent of the Church that keeps the seal, with a knife instead of a prayer.',
    how: 'Fast and fragile. Goes for the bearer. Radiant: holy magic does nothing to it.',
  },
  cantor: {
    who: 'A Penitent who leads the rites in song. The hymn is older than the Church.',
    how: 'Keeps behind the others. A long hymn heals every ally within 4 tiles. A stun breaks it.',
  },
  hollowed: {
    who: 'A Penitent who listened too long to what lies under the seal.',
    how: 'Runs past mercs to claw at the bearer. Its Occult touch builds up Dread.',
  },
  broodMother: {
    who: 'The Blight’s queen. The Marches’ crawlers are her children, sent up to keep the road shut.',
    how: 'Lays mites every few seconds. At half health she frenzies, lays more, and they hunt the bearer. Her brood dies with her.',
  },
  gatekeeper: {
    who: 'The Old King’s captain, at the last gate of the Rift Road. He let no one down in his life either.',
    how: 'Very heavy armor. A slow cleave across everything in front of him. At half health his horn calls three soldiers.',
  },
  abbess: {
    who: 'The head of the Church that keeps the seal. She knows what the bearer carries.',
    how: 'Sanctifies her own flock with a litany, and calls more of it.',
  },
  hollowedSaint: {
    who: 'The Church’s saint, Hollowed at the bottom of the Sunken Crown. The last to stand before the tomb.',
    how: 'Lunges at the bearer. A Dread aura around him widens at half health.',
  },
  creditor: {
    who: 'What the Writ was written for. The Guild hires the mercs to bring its vessel down to it.',
    how: 'Wakes in the bearer’s body. Every merc dead over the run makes it stronger, and the untorn dead rise for it. It drinks the bearer’s potions.',
  },
};

export const RACE_NAME: Record<Race, string> = {
  [Race.Human]: 'Human',
  [Race.Beast]: 'Beast',
  [Race.Undead]: 'Undead',
  [Race.Demon]: 'Demon',
  [Race.Insect]: 'Insect',
  [Race.Construct]: 'Construct',
  [Race.Plant]: 'Plant',
  [Race.Spirit]: 'Spirit',
  [Race.Dragon]: 'Dragon',
};

export const ELEMENT_NAME: Record<Element, string> = {
  [Element.Neutral]: 'Neutral',
  [Element.Fire]: 'Fire',
  [Element.Frost]: 'Frost',
  [Element.Storm]: 'Storm',
  [Element.Earth]: 'Earth',
  [Element.Venom]: 'Venom',
  [Element.Radiant]: 'Radiant',
  [Element.Occult]: 'Occult',
  [Element.Spectral]: 'Spectral',
};

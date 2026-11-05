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
  bloat: {
    who: 'A crawler the Blight filled until it could not stop swelling.',
    how: 'Walks into the party and bursts in a cloud of Venom, shown on the ground first. Kill it before it gets there, and it only pops.',
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
  hollowShieldbearer: {
    who: 'A soldier of the Old King’s guard who held the line behind a tower shield. It still holds it.',
    how: 'Its shield takes most of every blow from the front, and it turns slowly. Hit it from the side or behind, or with magic.',
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
  ossuaryPriest: {
    who: 'A Cantor who tends the Undercroft’s bones. It never lets the dead rest.',
    how: 'Keeps behind the others. Raises a fallen body as a husk with a short rite, up to 3 at a time. A stun breaks the rite.',
  },
  titheTaker: {
    who: 'A Penitent who collects the Church’s due, in kind.',
    how: 'Fast. Grabs an item from the pack and runs for the way out. Kill it and the item falls.',
  },
  confessor: {
    who: 'A Penitent who hears confessions with a chain, and absolves the sinner of what they carry.',
    how: 'Its blow strips one worn item from a merc, the weapon first, until the next area.',
  },
  flagellant: {
    who: 'A Penitent who scourges itself in the Church’s name.',
    how: 'The more it is hurt, the harder it hits. Its lash leaves a Bleed. Kill it fast.',
  },
  revenantKnight: {
    who: 'A knight of the Old King’s guard, who would not lie down when the capital sank.',
    how: 'Slow and heavily armored. Spectral: plain blows lose a third of their force, so use elements.',
  },
  gildedEffigy: {
    who: 'A statue of the guard, cast in the gold the Old King taxed from his people.',
    how: 'Stands still until the bearer passes close. Stun and fear do not take hold of it. Break its armor.',
  },
  drownedBell: {
    who: 'A bell of the flooded chapel, cracked, that still rings for the dead.',
    how: 'Never moves. While monsters stand near it, its toll builds Dread over a wide area. Break it first, or bring Brave and Devout mercs.',
  },
  whisperer: {
    who: 'A Hollowed that follows the others, murmuring what the Writ would rather not say.',
    how: 'Frail, and keeps behind its pack. Builds Dread in mercs within 4 tiles. Kill it first or keep your distance.',
  },
  skulker: {
    who: 'A Hollowed in a hood, with claws as long as its arms. You do not see it come.',
    how: 'Unseen until 2 tiles from the bearer, then it strikes and vanishes again. Area damage and light find it; so does a guard stance.',
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

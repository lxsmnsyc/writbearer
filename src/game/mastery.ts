import { type Upgrade, applyUpgrade, buildFor, offerUpgrades, upgradeById } from '../sim/builds';
import type RNG from '../core/rng';
import type Unit from '../sim/unit';

// Elite upgrade offers, as docs/design/16-builds.md says: 3 cards, pick 1.
// A card is an upgrade for one merc, or +2 shards once the merc has none left.

/** Cards in an offer. */
export const OFFER_CARDS = 3;
/** The shards a card pays when a merc has no upgrade left to take. */
export const SHARD_CARD = 2;

/** One card: an upgrade for the merc at `merc`, or shards if `upgrade` is null. */
export interface Card {
  // Index in the party's mercs, the bearer left out
  merc: number;
  upgrade: string | null;
}

/** What the player chooses among. */
export interface UpgradeOffer {
  title: string;
  cards: Card[];
}

// The upgrades of the merc's job it could take now, up to n.
function draw(merc: Unit, rng: RNG, n: number): Upgrade[] {
  const build = buildFor(merc.kind);
  return build ? offerUpgrades(merc, build.upgrades, rng, n) : [];
}

const shardCard = (merc: number): Card => ({ merc, upgrade: null });

/**
 * A Waystation's offers: one per living merc, 3 of its own spells' upgrades.
 * A merc with none left gets one card of shards.
 */
export function waystationOffers(mercs: readonly Unit[], rng: RNG): UpgradeOffer[] {
  const offers: UpgradeOffer[] = [];
  for (const [i, merc] of mercs.entries()) {
    if (!merc.alive) {
      continue;
    }
    const picks = draw(merc, rng, OFFER_CARDS);
    offers.push({
      title: `${merc.name}, ${merc.job.name}`,
      cards: picks.length > 0 ? picks.map((u) => ({ merc: i, upgrade: u.id })) : [shardCard(i)],
    });
  }
  return offers;
}

/**
 * A Mastery road's offer: one card each for different living mercs, drawn in
 * random order. Null if no merc lives.
 */
export function masteryOffer(
  mercs: readonly Unit[],
  rng: RNG,
  n = OFFER_CARDS,
): UpgradeOffer | null {
  const living: number[] = [];
  for (const [i, merc] of mercs.entries()) {
    if (merc.alive) {
      living.push(i);
    }
  }
  const cards: Card[] = [];
  for (const i of rng.shuffle(living).slice(0, n)) {
    const picks = draw(mercs[i], rng, 1);
    cards.push(picks.length > 0 ? { merc: i, upgrade: picks[0].id } : shardCard(i));
  }
  return cards.length > 0 ? { title: 'Mastery', cards } : null;
}

/** Why a card cannot be taken, or null. */
export function cannotTake(mercs: readonly Unit[], card: Card): string | null {
  const merc = mercs.at(card.merc);
  if (!merc?.alive) {
    return 'That merc is gone.';
  }
  if (card.upgrade === null) {
    return null;
  }
  const upgrade = upgradeById(card.upgrade);
  return upgrade ? null : 'Unknown upgrade.';
}

/** Gives a merc what a card holds. Returns why it failed, or null. */
export function takeCard(mercs: readonly Unit[], card: Card): string | null {
  const why = cannotTake(mercs, card);
  if (why) {
    return why;
  }
  const merc = mercs[card.merc];
  if (card.upgrade === null) {
    merc.shards += SHARD_CARD;
    return null;
  }
  const upgrade = upgradeById(card.upgrade);
  return upgrade ? applyUpgrade(merc, upgrade) : 'Unknown upgrade.';
}

/** Offers read back from a save, without cards whose upgrade no job has. */
export function loadOffers(saved: readonly UpgradeOffer[]): UpgradeOffer[] {
  const offers: UpgradeOffer[] = [];
  for (const offer of saved) {
    const cards = offer.cards.filter((c) => c.upgrade === null || upgradeById(c.upgrade));
    if (cards.length > 0) {
      offers.push({ title: offer.title, cards: cards.map((c) => ({ ...c })) });
    }
  }
  return offers;
}

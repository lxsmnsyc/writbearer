import {
  type Upgrade,
  applyUpgrade,
  buildFor,
  cannotUpgrade,
  offerUpgrades,
  upgradeById,
} from '../sim/builds';
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
  // Whether the pick pays a shard more, for a met bonus challenge
  bonus?: boolean;
}

/** The shard a met bonus challenge adds to a Mastery pick. */
export const BONUS_SHARDS = 1;

/** The layers (phases 2 to 4) whose Waystations offer upgrades. */
export const OFFER_LAYERS = { from: 1, to: 3 };

/** Whether a Waystation before this layer offers upgrades. */
export const offersAt = (layer: number): boolean =>
  layer >= OFFER_LAYERS.from && layer <= OFFER_LAYERS.to;

// The upgrades of the merc's job it could take now, up to n.
function draw(merc: Unit, rng: RNG, n: number): Upgrade[] {
  const build = buildFor(merc.kind);
  return build ? offerUpgrades(merc, build.upgrades, rng, n) : [];
}

const shardCard = (merc: number): Card => ({ merc, upgrade: null });

/**
 * A Waystation's offers: one per living merc, 3 of its own spells' upgrades.
 * A merc with none to take gets one card of shards. That is a merc whose 4
 * spells all hold one, or whose job has upgrades not built yet.
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
 * random order. A merc with none to take (all 4 spells hold one, or its job
 * has upgrades not built yet) gets a shard card. Null if no merc lives.
 */
export function masteryOffer(
  mercs: readonly Unit[],
  rng: RNG,
  bonus = false,
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
  return cards.length > 0 ? { title: 'Mastery', cards, bonus } : null;
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
  return upgrade ? cannotUpgrade(merc, upgrade) : 'Unknown upgrade.';
}

/** Gives a merc what a card holds. Returns why it failed, or null. */
export function takeCard(mercs: readonly Unit[], card: Card, bonus = false): string | null {
  const why = cannotTake(mercs, card);
  if (why) {
    return why;
  }
  const merc = mercs[card.merc];
  const upgrade = card.upgrade === null ? undefined : upgradeById(card.upgrade);
  const failed = upgrade ? applyUpgrade(merc, upgrade) : null;
  if (failed) {
    return failed;
  }
  merc.shards += (upgrade ? 0 : SHARD_CARD) + (bonus ? BONUS_SHARDS : 0);
  return null;
}

/**
 * Offers read back from a save, once the mercs are loaded: without cards that
 * can no longer be taken, and without an offer left with none, so a stale
 * save cannot pause the game for good.
 */
export function loadOffers(saved: readonly UpgradeOffer[], mercs: readonly Unit[]): UpgradeOffer[] {
  const offers: UpgradeOffer[] = [];
  for (const offer of saved) {
    const cards = offer.cards.filter((c) => cannotTake(mercs, c) === null);
    if (cards.length > 0) {
      offers.push({ ...offer, cards: cards.map((c) => ({ ...c })) });
    }
  }
  return offers;
}

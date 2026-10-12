import { CARD_OF, GEMS } from '../content/cards';
import { AFFIXES, BASES, GOLD, POTIONS, RARE_FIRST, RARE_SECOND } from '../content/items';
import type RNG from '../core/rng';
import { type Affix, type Item, type ItemBase, ItemType, Quality, type Span } from '../sim/item';
import type { Modifier } from '../sim/stats';
import { Category } from '../sim/stats';
import { Range, Rank } from '../sim/types';

let nextUid = 1;

// Base rolls by quality, as Diablo 2: inferior bases roll low, superior high.
const BASE_SCALE: Record<Quality, number> = {
  [Quality.Inferior]: 0.8,
  [Quality.Normal]: 1,
  [Quality.Superior]: 1.15,
  [Quality.Magic]: 1,
  [Quality.Rare]: 1,
};

// Most sockets each quality allows. See the quality table in the items design.
const MAX_SOCKETS: Record<Quality, number> = {
  [Quality.Inferior]: 2,
  [Quality.Normal]: 4,
  [Quality.Superior]: 3,
  [Quality.Magic]: 2,
  [Quality.Rare]: 1,
};

// Quality weights. Elites and bosses shift them up.
const QUALITY_WEIGHTS: Record<Rank, [Quality, number][]> = {
  [Rank.Normal]: [
    [Quality.Inferior, 12],
    [Quality.Normal, 50],
    [Quality.Superior, 14],
    [Quality.Magic, 20],
    [Quality.Rare, 4],
  ],
  [Rank.Elite]: [
    [Quality.Normal, 25],
    [Quality.Superior, 20],
    [Quality.Magic, 40],
    [Quality.Rare, 15],
  ],
  [Rank.Boss]: [
    [Quality.Superior, 10],
    [Quality.Magic, 50],
    [Quality.Rare, 40],
  ],
};

// Chance that a monster drops equipment, and how many pieces, by rank.
export const DROP_CHANCE: Record<Rank, number> = {
  [Rank.Normal]: 0.3,
  [Rank.Elite]: 1,
  [Rank.Boss]: 1,
};
export const DROP_COUNT: Record<Rank, number> = {
  [Rank.Normal]: 1,
  [Rank.Elite]: 2,
  [Rank.Boss]: 4,
};
// Chance of a pile of gold, apart from equipment.
export const GOLD_CHANCE = 0.4;

function weighted<T>(rng: RNG, entries: readonly [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.random() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) {
      return value;
    }
  }
  return entries[entries.length - 1][0];
}

const within = (rng: RNG, span: Span, scale: number): number =>
  Math.round(rng.range(span.min, span.max) * scale);

const middle = (span: Span): number => Math.round((span.min + span.max) / 2);

/** A plain copy of a base with middle rolls, such as starter gear. */
export function plainItem(base: ItemBase, itemLevel = 1): Item {
  return {
    uid: nextUid++,
    base,
    itemLevel,
    quality: Quality.Normal,
    rolls: {
      min: base.damage && middle(base.damage.min),
      max: base.damage && middle(base.damage.max),
      armor: base.armor && middle(base.armor),
      matk: base.matk && middle(base.matk),
    },
    affixes: [],
    bonuses: [],
    sockets: 0,
    cards: [],
    quantity: 1,
  };
}

// Picks affixes of one kind that fit the item, one per group, by frequency.
function pickAffixes(
  rng: RNG,
  item: Item,
  kind: Affix['kind'],
  count: number,
  taken: Set<string>,
): void {
  for (let i = 0; i < count; i++) {
    const pool = AFFIXES.filter(
      (a) =>
        a.kind === kind &&
        a.level <= item.itemLevel &&
        a.types.includes(item.base.type) &&
        !taken.has(a.group),
    );
    if (pool.length === 0) {
      return;
    }
    const affix = weighted(
      rng,
      pool.map((a): [Affix, number] => [a, a.frequency]),
    );
    taken.add(affix.group);
    const values = affix.rolls.map((r) => rng.int(r.min, r.max));
    item.affixes.push({ id: affix.id, values });
    item.bonuses.push(...affix.bonuses(values));
  }
}

/**
 * Rolls one piece of equipment for an item level. The base must have
 * dropped by that level; quality comes from the dropper's rank.
 */
export function rollItem(rng: RNG, itemLevel: number, rank: Rank = Rank.Normal): Item {
  const bases = BASES.filter((b) => b.level <= itemLevel);
  const base = rng.pick(bases);
  const quality = weighted(rng, QUALITY_WEIGHTS[rank]);
  const scale = BASE_SCALE[quality];
  const item: Item = {
    uid: nextUid++,
    base,
    itemLevel,
    quality,
    rolls: {
      min: base.damage && within(rng, base.damage.min, scale),
      max: base.damage && within(rng, base.damage.max, scale),
      armor: base.armor && within(rng, base.armor, scale),
      matk: base.matk && within(rng, base.matk, scale),
    },
    affixes: [],
    bonuses: [],
    sockets: 0,
    cards: [],
    quantity: 1,
  };
  const taken = new Set<string>();
  if (quality === Quality.Magic) {
    // At most one prefix and one suffix, and at least one of them.
    const both = rng.chance(0.5);
    const prefix = both || rng.chance(0.5);
    pickAffixes(rng, item, 'prefix', prefix ? 1 : 0, taken);
    pickAffixes(rng, item, 'suffix', both || !prefix ? 1 : 0, taken);
  } else if (quality === Quality.Rare) {
    // 3 to 6 affixes, at most 3 of each kind.
    const total = rng.int(3, 6);
    const prefixes = Math.min(3, rng.int(Math.max(0, total - 3), total));
    pickAffixes(rng, item, 'prefix', prefixes, taken);
    pickAffixes(rng, item, 'suffix', Math.min(3, total - prefixes), taken);
    item.name = `${rng.pick(RARE_FIRST)} ${rng.pick(RARE_SECOND)}`;
  }
  const cap = Math.min(base.maxSockets, MAX_SOCKETS[quality]);
  item.sockets = rng.chance(0.35) ? rng.int(1, Math.max(1, cap)) : 0;
  return item;
}

/** A pile of gold, more deeper in. */
export function rollGold(rng: RNG, itemLevel: number): Item {
  return {
    uid: nextUid++,
    base: GOLD,
    itemLevel,
    quality: Quality.Normal,
    rolls: {},
    affixes: [],
    bonuses: [],
    sockets: 0,
    cards: [],
    quantity: rng.int(4, 12) * itemLevel,
  };
}

// Chance a monster drops a potion, apart from equipment and gold.
export const POTION_CHANCE = 0.25;

/** A stack of potions, the strongest kind the item level allows half the time. */
export function rollPotion(rng: RNG, itemLevel: number, quantity = 1): Item {
  const kinds = POTIONS.filter((p) => p.level <= itemLevel);
  const base = rng.chance(0.6) ? kinds[0] : rng.pick(kinds);
  return potionStack(base, quantity);
}

/** A stack of one kind of potion. */
export function potionStack(base: ItemBase, quantity: number): Item {
  return { ...plainItem(base), quantity };
}

/** What a monster of this rank and level drops, if anything. */
export function rollDrops(rng: RNG, itemLevel: number, rank: Rank): Item[] {
  const out: Item[] = [];
  if (rng.chance(DROP_CHANCE[rank])) {
    for (let i = 0; i < DROP_COUNT[rank]; i++) {
      out.push(rollItem(rng, itemLevel, rank));
    }
  }
  if (rng.chance(GOLD_CHANCE)) {
    out.push(rollGold(rng, itemLevel));
  }
  if (rng.chance(POTION_CHANCE)) {
    out.push(rollPotion(rng, itemLevel));
  }
  return out;
}

// Chance a monster drops its card, by rank, and a gem, from the items design.
const CARD_CHANCE: Record<Rank, number> = {
  [Rank.Normal]: 0.05,
  [Rank.Elite]: 0.25,
  [Rank.Boss]: 1,
};
const GEM_CHANCE: Record<Rank, number> = {
  [Rank.Normal]: 0.04,
  [Rank.Elite]: 0.15,
  [Rank.Boss]: 0.5,
};

/** The card a slain monster drops, and a gem, either of them by chance. */
export function rollCards(rng: RNG, kind: string, rank: Rank): Item[] {
  const out: Item[] = [];
  const card = CARD_OF.get(kind);
  if (card && rng.chance(CARD_CHANCE[rank])) {
    out.push(plainItem(card));
  }
  if (rng.chance(GEM_CHANCE[rank])) {
    out.push(plainItem(rng.pick(GEMS)));
  }
  return out;
}

// Names of item kinds, for what a card fits.
const TYPE_NAME: Partial<Record<ItemType, string>> = {
  [ItemType.Weapon]: 'weapons',
  [ItemType.Shield]: 'shields',
  [ItemType.Head]: 'helms',
  [ItemType.Body]: 'body armor',
  [ItemType.Cloak]: 'cloaks',
  [ItemType.Boots]: 'boots',
  [ItemType.Accessory]: 'accessories',
};

/** An item's full name: "Sturdy Hood of the Bear", or a rare's own name. */
export function itemName(item: Item): string {
  if (item.base.type === ItemType.Gold) {
    return `${item.quantity} Gold`;
  }
  if (item.base.type === ItemType.Potion) {
    return item.quantity > 1 ? `${item.base.name} ×${item.quantity}` : item.base.name;
  }
  if (item.quality === Quality.Rare && item.name) {
    return item.name;
  }
  const prefix = item.affixes
    .map((a) => AFFIXES.find((x) => x.id === a.id))
    .find((a) => a?.kind === 'prefix');
  const suffix = item.affixes
    .map((a) => AFFIXES.find((x) => x.id === a.id))
    .find((a) => a?.kind === 'suffix');
  const words = [prefix?.name, item.base.name, suffix?.name];
  if (item.quality === Quality.Inferior) {
    words.unshift('Crude');
  } else if (item.quality === Quality.Superior) {
    words.unshift('Fine');
  }
  return words.filter(Boolean).join(' ');
}

const STAT_NAMES: Partial<Record<string, string>> = {
  maxHp: 'health',
  maxMana: 'mana',
  armor: 'armor',
  resistance: 'resistance',
  accuracy: 'accuracy',
  evasion: 'evasion',
  blockChance: 'block chance',
  atkMin: 'attack',
  crit: 'critical rate',
};

const RACE_NAMES = [
  'Humans',
  'Beasts',
  'Undead',
  'Demons',
  'Insects',
  'Constructs',
  'Plants',
  'Spirits',
  'Dragons',
];

// One bonus as a line of text, such as "+3 VIT" or "+20% damage to Undead".
function describe(m: Modifier): string | null {
  if ('base' in m) {
    return `+${m.add} ${m.base.toUpperCase()}`;
  }
  if ('stat' in m) {
    // Attack bonuses come as a min and max pair. Only the min is shown.
    if (m.stat === 'atkMax') {
      return null;
    }
    const name = STAT_NAMES[m.stat] ?? m.stat;
    return m.percent ? `+${m.percent}% ${name}` : `+${m.add ?? 0} ${name}`;
  }
  if ('amplify' in m) {
    if (m.amplify === Category.Race) {
      return `+${m.percent}% damage to ${RACE_NAMES[m.key] ?? 'them'}`;
    }
    if (m.amplify === Category.AttackRange) {
      const ranged: number = Range.Ranged;
      return `+${m.percent}% ${m.key === ranged ? 'ranged' : 'melee'} damage`;
    }
  }
  return null;
}

/** The lines an item's tooltip shows: base values, then affixes. */
export function itemLines(item: Item): string[] {
  const lines: string[] = [];
  const potion = item.base.potion;
  if (potion?.health) {
    lines.push(`Restores ${potion.health * 100}% of health over 3 seconds`);
  }
  if (potion?.mana) {
    lines.push(`Restores ${potion.mana * 100}% of mana over 3 seconds`);
  }
  if (item.rolls.min !== undefined) {
    lines.push(`Damage ${item.rolls.min} to ${item.rolls.max}`);
  }
  if (item.rolls.matk) {
    lines.push(`Magic attack ${item.rolls.matk}`);
  }
  if (item.rolls.armor) {
    lines.push(`Armor ${item.rolls.armor}`);
  }
  if (item.base.block) {
    lines.push(
      `Blocks ${item.base.block.chance}% of blows from the front, for ${item.base.block.amount}%`,
    );
  }
  for (const m of item.bonuses) {
    const line = describe(m);
    if (line) {
      lines.push(line);
    }
  }
  const socket = item.base.socket;
  if (socket) {
    lines.push(socket.describe);
    lines.push(
      socket.fits === 'any'
        ? 'Fits any socket'
        : `Fits: ${socket.fits.map((t) => TYPE_NAME[t]).join(', ')}`,
    );
  }
  if (item.sockets > 0) {
    const filled = item.cards.map((c) => c.name);
    const empty = Array.from({ length: item.sockets - item.cards.length }, () => 'empty');
    lines.push(`Sockets: ${[...filled, ...empty].join(', ')}`);
    for (const c of item.cards) {
      lines.push(`  ${c.name}: ${c.socket?.describe ?? ''}`);
    }
  }
  if (item.base.jobs) {
    lines.push(`For: ${item.base.jobs.join(', ')}`);
  }
  lines.push(`Weight ${item.base.weight}`);
  return lines;
}

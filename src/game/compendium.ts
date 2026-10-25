import { BESTIARY, ELEMENT_NAME, RACE_NAME } from '../content/bestiary';
import { CARDS, CARD_OF } from '../content/cards';
import { BASES, BASE_BY_ID } from '../content/items';
import { MONSTERS, type MonsterKind } from '../content/roster';
import { TRAIT_BY_ID } from '../content/traits';
import { SETS, type SetDef, type SetPiece } from '../content/sets';
import { UNIQUES, type UniqueDef } from '../content/uniques';
import { TYPE_NAME } from '../gen/loot';
import { type Item, ItemType } from '../sim/item';
import { Element, Race } from '../sim/types';
import { Store, readRecord, writeRecord } from './store';

// The compendium, from the overview: what the player has discovered over
// every run. It unlocks no power; it carries knowledge from run to run.
// Only the interface hides what has not been found: the mercs' AI always
// reads the real data.

export type Ending = 'fallen' | 'sealed' | 'risen';

/** A merc met on some run, as it was then. */
export interface MetMerc {
  name: string;
  job: string;
  traits: string[];
  level: number;
}

/** What the compendium keeps, as stored. */
export interface CompendiumData {
  version: number;
  mercs: MetMerc[];
  // Monster kinds seen awake, and how many of each were beaten
  seen: string[];
  beaten: Record<string, number>;
  // Item bases, uniques and cards acquired, and cards seen dropped
  bases: string[];
  uniques: string[];
  // Set pieces acquired, by piece id
  pieces?: string[];
  cards: string[];
  cardsSeen: string[];
  endings: Record<Ending, number>;
  // The deepest phase an endless run reached
  deepest?: number;
}

const VERSION = 1;
const KEY = 'book';
// How long after a kill the count of kills is written, so a fight's kills
// make one write. Something found for the first time is written at once.
const WRITE_DELAY = 1000;

const empty = (): CompendiumData => ({
  version: VERSION,
  mercs: [],
  seen: [],
  beaten: {},
  bases: [],
  uniques: [],
  cards: [],
  cardsSeen: [],
  endings: { fallen: 0, sealed: 0, risen: 0 },
});

const isData = (value: unknown): value is CompendiumData =>
  typeof value === 'object' && value !== null && 'version' in value && value.version === VERSION;

const sameMerc = (a: MetMerc, b: MetMerc): boolean =>
  a.name === b.name && a.job === b.job && a.traits.join() === b.traits.join();

/** The kinds a monster entry is listed for, in the order they are met. */
export const MONSTER_ORDER: readonly MonsterKind[] = [
  'mite',
  'husk',
  'crawler',
  'hollowSoldier',
  'hollowArcher',
  'hornBearer',
  'penitent',
  'penitentSlinger',
  'cantor',
  'hollowed',
  'broodMother',
  'gatekeeper',
  'abbess',
  'hollowedSaint',
  'creditor',
];

const MONSTER_KINDS: ReadonlySet<string> = new Set(MONSTER_ORDER);

/**
 * What the player has found, over every run. Each record returns whether it
 * was new. Changes are written to the browser's storage shortly after.
 */
export class Compendium {
  data: CompendiumData = empty();
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Nothing is written until what earlier runs found is read, so a write
  // never replaces it; what is found meanwhile waits.
  private loaded = false;
  private dirty = false;

  constructor(private readonly store = true) {}

  /** Reads what earlier runs found, and merges what this run has found since. */
  async load(): Promise<void> {
    if (!this.store) {
      return;
    }
    const stored = await readRecord(Store.Compendium, KEY);
    if (isData(stored)) {
      this.merge(stored);
    }
    this.loaded = true;
    if (this.dirty) {
      this.flush();
    }
  }

  /** Adds what another record found to this one. */
  merge(other: CompendiumData): void {
    const d = this.data;
    for (const m of other.mercs) {
      if (!d.mercs.some((n) => sameMerc(m, n))) {
        d.mercs.push(m);
      }
    }
    const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
    d.seen = union(d.seen, other.seen);
    d.bases = union(d.bases, other.bases);
    d.uniques = union(d.uniques, other.uniques);
    d.pieces = union(d.pieces ?? [], other.pieces ?? []);
    d.cards = union(d.cards, other.cards);
    d.cardsSeen = union(d.cardsSeen, other.cardsSeen);
    for (const [kind, n] of Object.entries(other.beaten)) {
      d.beaten[kind] = (d.beaten[kind] ?? 0) + n;
    }
    d.deepest = Math.max(d.deepest ?? 0, other.deepest ?? 0);
    for (const ending of ['fallen', 'sealed', 'risen'] as const) {
      d.endings[ending] += other.endings[ending];
    }
  }

  // Writes the record now, or shortly for what only adds to a count.
  private changed(now = true): void {
    if (!this.store) {
      return;
    }
    this.dirty = true;
    if (now) {
      this.flush();
    } else {
      this.timer ??= setTimeout(() => {
        this.flush();
      }, WRITE_DELAY);
    }
  }

  /** Writes what is waiting to be written, as the page closes. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.store && this.loaded && this.dirty) {
      this.dirty = false;
      writeRecord(Store.Compendium, KEY, this.data);
    }
  }

  // Adds a key to a list once.
  private add(list: string[], key: string): boolean {
    if (list.includes(key)) {
      return false;
    }
    list.push(key);
    this.changed();
    return true;
  }

  /** A merc recruited or met. */
  meet(merc: MetMerc): boolean {
    if (this.data.mercs.some((m) => sameMerc(m, merc))) {
      return false;
    }
    this.data.mercs.push({ ...merc, traits: [...merc.traits] });
    this.changed();
    return true;
  }

  /** A monster kind seen awake. Mercs raised against the party are not one. */
  see(kind: string): boolean {
    return MONSTER_KINDS.has(kind) && this.add(this.data.seen, kind);
  }

  /** A monster beaten. */
  beat(kind: string): boolean {
    if (!MONSTER_KINDS.has(kind)) {
      return false;
    }
    this.see(kind);
    const n = this.data.beaten[kind] ?? 0;
    this.data.beaten[kind] = n + 1;
    this.changed(n === 0);
    return n === 0;
  }

  /** An item acquired: its base, and a unique or the cards set in it. */
  acquire(item: Item): boolean {
    let found = false;
    if (item.base.type === ItemType.Card) {
      found = this.add(this.data.cardsSeen, item.base.id) || found;
      found = this.add(this.data.cards, item.base.id) || found;
    } else if (item.base.type !== ItemType.Gold && item.base.type !== ItemType.Potion) {
      found = this.add(this.data.bases, item.base.id) || found;
    }
    if (item.unique !== undefined) {
      found = this.add(this.data.uniques, item.unique) || found;
    }
    if (item.piece !== undefined) {
      this.data.pieces ??= [];
      found = this.add(this.data.pieces, item.piece) || found;
    }
    for (const card of item.cards) {
      found = this.add(this.data.cards, card.id) || found;
    }
    return found;
  }

  /** A card seen as it dropped, picked up or not. */
  seeDrop(item: Item): boolean {
    return item.base.type === ItemType.Card && this.add(this.data.cardsSeen, item.base.id);
  }

  /** The phase an endless run fell in. Returns whether it was the deepest yet. */
  reach(phase: number): boolean {
    if (phase <= (this.data.deepest ?? 0)) {
      return false;
    }
    this.data.deepest = phase;
    this.changed();
    return true;
  }

  /** How a run ended. */
  end(ending: Ending): void {
    this.data.endings[ending]++;
    if (ending === 'risen') {
      this.see('creditor');
    }
    this.changed();
  }
}

/** One entry as the compendium shows it: hidden details are "?". */
export interface Entry {
  name: string;
  // Whether it is known in full
  known: boolean;
  lines: string[];
  // What the interface draws it as: a monster's kind, an item's base
  icon?: string;
}

export interface Section {
  title: string;
  // How much of it has been found, such as "4 of 12"
  found: string;
  entries: Entry[];
}

const HIDDEN = '?';

function monsterEntry(d: CompendiumData, kind: MonsterKind): Entry {
  const t = MONSTERS[kind];
  const beaten = d.beaten[kind] ?? 0;
  const seen = d.seen.includes(kind) || beaten > 0;
  // The Creditor shows once it has been beaten or has risen.
  if (kind === 'creditor' && !seen) {
    return { name: HIDDEN, known: false, lines: ['Something waits at the bottom of the Hollow.'] };
  }
  if (!seen) {
    return { name: HIDDEN, known: false, lines: ['Not yet met.'] };
  }
  const card = CARD_OF.get(kind);
  if (beaten === 0) {
    return {
      name: t.job.name,
      known: false,
      lines: [
        `Race ${HIDDEN} · Element ${HIDDEN}`,
        `How it fights: ${HIDDEN}`,
        ...(card ? [`Card: ${HIDDEN}`] : []),
      ],
    };
  }
  const race = 'race' in t ? t.race : Race.Human;
  const element = 'element' in t ? t.element : Element.Neutral;
  return {
    name: t.job.name,
    known: true,
    lines: [
      `${RACE_NAME[race]} · ${ELEMENT_NAME[element]} · beaten ${beaten}×`,
      BESTIARY[kind].how,
      BESTIARY[kind].who,
      ...(card ? [`Card: ${card.name}`] : []),
    ],
  };
}

// Each number in a line from the lowest rolls, as a range up to the highest.
function rangeLines(def: UniqueDef): string[] {
  const low = def.lines(def.rolls.map((s) => s.min));
  const high = def.lines(def.rolls.map((s) => s.max));
  return low.map((line, i) => {
    const tops = high[i]?.match(/\d+/g) ?? [];
    let n = 0;
    return line.replaceAll(/\d+/g, (m) => {
      const top = tops.at(n++);
      return top !== undefined && top !== m ? `${m}–${top}` : m;
    });
  });
}

function uniqueEntry(d: CompendiumData, def: UniqueDef): Entry {
  const base = BASE_BY_ID.get(def.base);
  if (!d.uniques.includes(def.id)) {
    // Only its silhouette: what it is made on
    return { name: HIDDEN, known: false, lines: [`A unique ${base?.name ?? 'item'}.`] };
  }
  return {
    name: def.name,
    known: true,
    lines: [base?.name ?? def.base, ...rangeLines(def), def.lore],
  };
}

function pieceEntry(d: CompendiumData, set: SetDef, piece: SetPiece): Entry {
  const base = BASE_BY_ID.get(piece.base);
  if (!d.pieces?.includes(piece.id)) {
    return { name: HIDDEN, known: false, lines: [`A piece of ${set.name}: ${base?.name ?? ''}.`] };
  }
  return {
    name: piece.name,
    known: true,
    lines: [
      ...piece.lines,
      `${set.name}: ${set.bonuses.map((b) => `${b.count}, ${b.line}`).join('; ')}`,
    ],
  };
}

function cardEntry(d: CompendiumData, id: string): Entry {
  const card = CARDS.find((c) => c.id === id);
  if (!card?.socket) {
    return { name: HIDDEN, known: false, lines: [] };
  }
  if (!d.cardsSeen.includes(id) && !d.cards.includes(id)) {
    return { name: HIDDEN, known: false, lines: ['Not yet seen.'] };
  }
  if (!d.cards.includes(id)) {
    return { name: card.name, known: false, lines: [`Effect: ${HIDDEN}`] };
  }
  const { fits } = card.socket;
  return {
    name: card.name,
    known: true,
    lines: [
      card.socket.describe,
      fits === 'any' ? 'Fits any socket.' : `Fits ${fits.map((t) => TYPE_NAME[t]).join(', ')}.`,
    ],
  };
}

const count = (found: number, total: number): string => `${found} of ${total}`;

/** The compendium's sections, as the interface shows them. */
export function compendiumView(d: CompendiumData): Section[] {
  const monsters = MONSTER_ORDER.map((k) => ({ ...monsterEntry(d, k), icon: k }));
  const gear = BASES;
  const ended = d.endings.fallen + d.endings.sealed + d.endings.risen;
  return [
    {
      title: 'Monsters',
      found: count(monsters.filter((e) => e.known).length, monsters.length),
      entries: monsters,
    },
    {
      title: 'Mercs',
      found: `${d.mercs.length} met`,
      entries: d.mercs.map((m) => ({
        name: m.name,
        known: true,
        icon: m.job.toLowerCase(),
        lines: [
          `${m.job}, level ${m.level}`,
          m.traits.map((t) => TRAIT_BY_ID.get(t)?.name ?? t).join(', ') || 'No traits',
        ],
      })),
    },
    {
      title: 'Uniques',
      found: count(d.uniques.length, UNIQUES.length),
      entries: UNIQUES.map((u) => ({ ...uniqueEntry(d, u), icon: u.base })),
    },
    {
      title: 'Sets',
      found: count(d.pieces?.length ?? 0, SETS.flatMap((s) => s.pieces).length),
      entries: SETS.flatMap((set) =>
        set.pieces.map((p) => ({ ...pieceEntry(d, set, p), icon: p.base })),
      ),
    },
    {
      title: 'Cards',
      found: count(d.cards.length, CARDS.length),
      entries: CARDS.map((c) => ({
        ...cardEntry(d, c.id),
        icon: c.id.endsWith('Card') ? 'card' : 'gem',
      })),
    },
    {
      title: 'Gear',
      found: count(gear.filter((b) => d.bases.includes(b.id)).length, gear.length),
      entries: gear.map((b) =>
        d.bases.includes(b.id)
          ? { name: b.name, known: true, lines: [], icon: b.id }
          : { name: HIDDEN, known: false, lines: [], icon: b.id },
      ),
    },
    {
      title: 'Runs',
      found: `${ended} ended`,
      entries: [
        { name: 'The bearer fell', known: true, lines: [`${d.endings.fallen}×`] },
        { name: 'The Creditor sealed again', known: true, lines: [`${d.endings.sealed}×`] },
        { name: 'The Creditor rose', known: true, lines: [`${d.endings.risen}×`] },
        {
          name: 'Endless: deepest phase',
          known: true,
          lines: [d.deepest ? `Phase ${d.deepest}` : 'Not yet played'],
        },
      ],
    },
  ];
}

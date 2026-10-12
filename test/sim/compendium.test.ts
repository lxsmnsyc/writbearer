import { describe, expect, it } from 'vitest';
import { CARD_BY_MONSTER } from '../../src/content/cards';
import { BASE_BY_ID } from '../../src/content/items';
import { UNIQUE_BY_ID } from '../../src/content/uniques';
import RNG from '../../src/core/rng';
import { Compendium, type Entry, type Section, compendiumView } from '../../src/game/compendium';
import { makeUnique, plainItem } from '../../src/gen/loot';

const book = (): Compendium => new Compendium(false);
const section = (c: Compendium, title: string): Section =>
  compendiumView(c.data).find((s) => s.title === title)!;
const monster = (c: Compendium, i: number): Entry => section(c, 'Monsters').entries[i];

describe('the compendium', () => {
  it('hides a monster until met, and its details until beaten', () => {
    const c = book();
    expect(monster(c, 0)).toEqual({ name: '?', known: false, lines: ['Not yet met.'] });
    expect(c.see('mite')).toBe(true);
    expect(c.see('mite')).toBe(false);
    expect(monster(c, 0).name).toBe('Mite');
    expect(monster(c, 0).lines.join(' ')).toContain('Race ?');
    expect(c.beat('mite')).toBe(true);
    expect(c.beat('mite')).toBe(false);
    const known = monster(c, 0);
    expect(known.known).toBe(true);
    expect(known.lines[0]).toBe('Insect · Venom · beaten 2×');
    expect(section(c, 'Monsters').found).toBe('1 of 12');
  });

  it('keeps the Creditor nameless until it is beaten or has risen', () => {
    const c = book();
    const creditor = (): Entry => section(c, 'Monsters').entries.at(-1)!;
    expect(creditor().name).toBe('?');
    expect(creditor().lines[0]).toMatch(/bottom of the Hollow/);
    c.end('risen');
    expect(creditor().name).toBe('The Creditor');
    expect(section(c, 'Runs').entries[2].lines).toEqual(['1×']);
  });

  it('never counts a merc raised against the party as a monster', () => {
    const c = book();
    expect(c.beat('vanguard')).toBe(false);
    expect(c.data.beaten).toEqual({});
  });

  it('shows a card’s name once seen, and its effect once acquired', () => {
    const c = book();
    const card = plainItem(CARD_BY_MONSTER.husk);
    const entry = (): Entry =>
      section(c, 'Cards').entries.find((e) => e.name === 'Husk Card') ?? {
        name: '?',
        known: false,
        lines: [],
      };
    expect(entry().name).toBe('?');
    c.seeDrop(card);
    expect(entry().lines).toEqual(['Effect: ?']);
    c.acquire(card);
    expect(entry().known).toBe(true);
    expect(entry().lines[0]).toBe('+10% max health.');
  });

  it('shows a unique’s silhouette, then its name and value ranges', () => {
    const c = book();
    const entries = (): Entry[] => section(c, 'Uniques').entries;
    expect(entries()[0]).toEqual({ name: '?', known: false, lines: ['A unique Flanged Mace.'] });
    c.acquire(makeUnique(new RNG(1), UNIQUE_BY_ID.get('debtorsChain')!));
    expect(entries()[0].name).toBe('Debtor’s Chain');
    expect(entries()[0].lines).toContain('+30–50% attack');
    expect(c.data.bases).toContain('flangedMace');
  });

  it('records each merc met once, and gear and cards set in it', () => {
    const c = book();
    const odo = { name: 'Odo', job: 'Vanguard', traits: ['loyal'], level: 5 };
    expect(c.meet(odo)).toBe(true);
    expect(c.meet({ ...odo })).toBe(false);
    const sword = plainItem(BASE_BY_ID.get('armingSword')!);
    sword.cards = [CARD_BY_MONSTER.crawler];
    c.acquire(sword);
    expect(c.data.cards).toEqual(['crawlerCard']);
    expect(section(c, 'Mercs').entries[0].lines).toEqual(['Vanguard, level 5', 'Loyal']);
  });

  it('merges what earlier runs found with what this one found', () => {
    const earlier = book();
    earlier.beat('husk');
    earlier.end('fallen');
    const now = book();
    now.beat('husk');
    now.see('crawler');
    now.merge(earlier.data);
    expect(now.data.beaten.husk).toBe(2);
    expect(now.data.seen.sort((a, b) => a.localeCompare(b))).toEqual(['crawler', 'husk']);
    expect(now.data.endings.fallen).toBe(1);
  });
});

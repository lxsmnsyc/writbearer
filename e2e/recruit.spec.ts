import { type Page, expect, test } from '@playwright/test';
import { enterGuild, hire, kinds, recruits, talkTo, titlePanel } from './support/guild';

// The names of the Guild House recruits of the seed ASHEN, cheapest first,
// from the same draw the game makes.
async function byWage(page: Page): Promise<string[]> {
  const paths = ['/src/content/recruits.ts', '/src/core/seed.ts', '/src/game/stage.ts'] as const;
  return page.evaluate(async (from) => {
    const read = (mod: unknown, key: string): unknown =>
      mod !== null && typeof mod === 'object'
        ? Object.getOwnPropertyDescriptor(mod, key)?.value
        : undefined;
    const content: unknown = await import(from[0]);
    const seed: unknown = await import(from[1]);
    const stage: unknown = await import(from[2]);
    const Streams = read(seed, 'RunStreams');
    const roll = read(content, 'rollStartingOffers');
    if (typeof Streams !== 'function' || typeof roll !== 'function') {
      return [];
    }
    const streams: unknown = Reflect.construct(Streams, ['ASHEN']);
    const get = read(Object.getPrototypeOf(streams), 'get');
    if (typeof get !== 'function') {
      return [];
    }
    // Stream.Recruits is 'recruits', a const enum the browser cannot import.
    const rng: unknown = Reflect.apply(get, streams, [1, 'recruits']);
    const offers: unknown = Reflect.apply(roll, null, [rng, read(stage, 'START_LEVEL')]);
    const list: { name: string; wage: number }[] = [];
    for (const o of Array.isArray(offers) ? offers : []) {
      list.push({ name: String(read(o, 'name')), wage: Number(read(o, 'wage')) });
    }
    list.sort((x, y) => x.wage - y.wage);
    const names: string[] = [];
    for (const o of list) {
      names.push(o.name);
    }
    return names;
  }, paths);
}

// The Guild House offers five recruits, drawn by slot.
const OFFERS = 5;

test('a run begins in the Guild House: five recruits of five jobs, the first one free', async ({
  page,
}) => {
  await page.goto('/?seed=ASHEN');
  await expect(titlePanel(page)).toBeVisible();
  await enterGuild(page);
  const HIREABLE = await kinds(page, 'HIREABLE');
  const FIGHTERS = await kinds(page, 'FIGHTERS');
  const waiting = await recruits(page);
  expect(waiting).toHaveLength(OFFERS);
  expect(new Set(waiting.map((r) => r.name)).size).toBe(OFFERS);
  expect(new Set(waiting.map((r) => r.kind)).size).toBe(OFFERS);
  for (const r of waiting) {
    expect(HIREABLE).toContain(r.kind);
  }

  const party = page.getByRole('navigation', { name: 'Party' });
  const fighter = waiting.find((r) => FIGHTERS.includes(r.kind))!;
  await hire(page, fighter);
  await expect(party.getByRole('button')).toHaveCount(1);
  await expect(party.getByRole('button').first()).toContainText(fighter.name);

  // The next costs its wage.
  const dialog = await talkTo(page, (await recruits(page))[0]);
  await expect(dialog.getByRole('button', { name: /Hire for \d+ gold/ })).toBeVisible();
});

test('the same seed offers the same recruits', async ({ page }) => {
  const names = async (): Promise<string[]> => {
    await page.goto('/?seed=WRIT');
    await expect.poll(async () => (await recruits(page)).length).toBe(OFFERS);
    return (await recruits(page)).map((r) => `${r.name}/${r.kind}`);
  };
  expect(await names()).toEqual(await names());
});

test('four of the five may be hired; the fifth stays at the Guild House', async ({ page }) => {
  test.setTimeout(180_000);
  await enterGuild(page);
  const party = page.getByRole('navigation', { name: 'Party' });
  // The dearest one first, which the Guild pays, so the purse covers the
  // three cheapest after it.
  const order = await byWage(page);
  for (let n = 1; n <= 4; n++) {
    const next = (await recruits(page)).find((r) => r.name === order[n === 1 ? 4 : n - 2])!;
    await hire(page, next);
    await expect(party.getByRole('button')).toHaveCount(n);
  }
  const fifth = await recruits(page);
  expect(fifth).toHaveLength(1);
  expect(fifth[0].name).toBe(order[3]);
  const dialog = await talkTo(page, fifth[0]);
  await dialog.getByRole('button', { name: /Take|Hire/ }).click();
  await expect(dialog.getByText('The party is full: 4 mercs at most.')).toBeVisible();
  await expect(party.getByRole('button')).toHaveCount(4);
  expect(await recruits(page)).toHaveLength(1);
});

test('the road out stays shut until a fighter is hired', async ({ page }) => {
  await enterGuild(page);
  const cleric = (await recruits(page)).find((r) => r.kind === 'cleric')!;
  await hire(page, cleric);
  const canvas = page.locator('canvas');
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await expect
    .poll(async () => Number((await canvas.getAttribute('data-bearer'))?.split(',')[0]), {
      timeout: 15000,
    })
    .toBeGreaterThan(20);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  const box = (await canvas.boundingBox())!;
  const [sx, sy] = ((await canvas.getAttribute('data-exits')) ?? '').split(',').map(Number);
  await page.mouse.click(box.x + sx * box.width, box.y + sy * box.height);
  await page.waitForTimeout(3000);
  // Still in the Guild House, its other recruits waiting
  expect((await recruits(page)).length).toBe(OFFERS - 1);
});

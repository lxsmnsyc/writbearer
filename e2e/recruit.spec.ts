import { expect, test } from '@playwright/test';
import { enterGuild, hire, recruits, talkTo, titlePanel } from './support/guild';

test('a run begins in the Guild House: four recruits, the first one free', async ({ page }) => {
  await page.goto('/?seed=ASHEN');
  await expect(titlePanel(page)).toBeVisible();
  await enterGuild(page);
  const waiting = await recruits(page);
  expect(waiting).toHaveLength(4);
  expect(new Set(waiting.map((r) => r.name)).size).toBe(4);
  expect(new Set(waiting.map((r) => r.kind))).toEqual(new Set(['vanguard', 'ranger', 'cleric']));

  const party = page.getByRole('navigation', { name: 'Party' });
  const fighter = waiting.find((r) => r.kind !== 'cleric')!;
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
    await expect.poll(async () => (await recruits(page)).length).toBe(4);
    return (await recruits(page)).map((r) => `${r.name}/${r.kind}`);
  };
  expect(await names()).toEqual(await names());
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
  expect((await recruits(page)).length).toBe(3);
});

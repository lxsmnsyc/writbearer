import { type Page, expect, test } from '@playwright/test';
import { recruits, titlePanel } from './support/guild';

const offers = async (page: Page): Promise<string[]> => {
  await expect.poll(async () => (await recruits(page)).length).toBe(4);
  return (await recruits(page)).map((r) => `${r.name}/${r.kind}`);
};

test('a seed typed in gives the same run as its link, and the link can be copied', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?seed=WRIT');
  const shared = await offers(page);

  await page.goto('/?seed=ASHEN');
  const seed = page.getByRole('form', { name: 'Seed' });
  await expect(seed).toContainText('ASHEN');
  await seed.getByRole('textbox', { name: 'Play a seed' }).fill(' writ ');
  await seed.getByRole('button', { name: 'Play' }).click();
  await expect(seed).toContainText('Seed WRIT');
  await expect.poll(async () => offers(page)).toEqual(shared);

  await titlePanel(page).getByRole('radio', { name: 'Endless' }).click();
  await seed.getByRole('button', { name: 'Copy link' }).click();
  await expect(seed.getByRole('status')).toBeVisible();
  const link = await page.evaluate(async () => navigator.clipboard.readText());
  expect(new URL(link).search).toBe('?seed=WRIT&endless');

  await seed.getByRole('button', { name: 'New seed' }).click();
  await expect(seed).not.toContainText('Seed WRIT');
});

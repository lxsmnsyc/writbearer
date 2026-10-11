import { expect, test } from '@playwright/test';

test('a run begins with a pick of one merc from three', async ({ page }) => {
  await page.goto('/?seed=ASHEN');
  const picker = page.getByRole('complementary', { name: 'Choose your first merc' });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('article')).toHaveCount(3);
  const first = picker.getByRole('article').first();
  const label = (await first.getAttribute('aria-label')) ?? '';
  const name = label.split(',')[0];
  await first.getByRole('button', { name: 'Take' }).click();
  await expect(picker).toBeHidden();

  const party = page.getByRole('navigation', { name: 'Party' });
  await expect(party.getByRole('button')).toHaveCount(1);
  await expect(party.getByRole('button').first()).toContainText(name);
});

test('the same seed offers the same mercs', async ({ page }) => {
  const names = async (): Promise<string[]> => {
    await page.goto('/?seed=WRIT');
    const cards = page
      .getByRole('complementary', { name: 'Choose your first merc' })
      .getByRole('article');
    await expect(cards).toHaveCount(3);
    return cards.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  };
  expect(await names()).toEqual(await names());
});

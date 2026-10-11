import { expect, test } from '@playwright/test';

test('M opens the layer map, from the start to the boss, and closes it', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);
  await page.keyboard.press('m');
  const map = page.getByRole('complementary', { name: 'Map' });
  await expect(map).toBeVisible();
  await expect(map).toContainText('The Marches');
  await expect(map.getByLabel('Area 1: Fight')).toHaveCount(1);
  await expect(map.getByLabel('Area 8: Boss')).toHaveCount(1);
  await expect(map.getByLabel(/^Area 7: /).filter({ hasText: 'Camp' })).not.toHaveCount(0);
  await page.keyboard.press('m');
  await expect(map).toBeHidden();
});

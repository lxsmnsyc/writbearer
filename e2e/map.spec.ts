import { expect, test } from '@playwright/test';

test('M opens the map: the world as walked, and the layer from the start to the boss', async ({
  page,
}) => {
  await page.goto('/?party=vanguard,ranger');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);
  await page.keyboard.press('m');
  const map = page.getByRole('complementary', { name: 'Map' });
  await expect(map).toBeVisible();
  await expect(map).toContainText('The Marches');
  // The world: the ground walked so far, and a mark past each exit
  await expect(map.getByRole('img', { name: /areas walked/ })).toBeVisible();
  await expect(map.getByLabel(/^Exit: /)).not.toHaveCount(0);
  // The layer: its areas from the first to the boss
  await map.getByRole('tab', { name: 'Layer' }).click();
  await expect(map.getByLabel('Area 1: Hunt')).toHaveCount(1);
  await expect(map.getByLabel('Area 8: Boss')).toHaveCount(1);
  await expect(map.getByLabel(/^Area 7: /).filter({ hasText: 'Camp' })).not.toHaveCount(0);
  await page.keyboard.press('m');
  await expect(map).toBeHidden();
});

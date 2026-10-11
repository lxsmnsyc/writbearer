import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);
});

test('I opens the inventory, and gear moves between a merc and the pack', async ({ page }) => {
  await page.keyboard.press('i');
  const panel = page.getByRole('complementary', { name: 'Inventory' });
  await expect(panel).toBeVisible();
  const pack = panel.getByRole('list', { name: 'Pack' });
  const gear = panel.getByRole('list', { name: 'Equipment' });

  await panel.getByRole('tab', { name: 'Ranger' }).click();
  await gear.getByRole('button', { name: 'Hunting Bow', exact: true }).click();
  await expect(pack.getByRole('button', { name: 'Hunting Bow', exact: true })).toBeVisible();
  await expect(gear.getByRole('button', { name: 'Hunting Bow', exact: true })).toHaveCount(0);

  // The Vanguard cannot use a bow.
  await panel.getByRole('tab', { name: 'Vanguard' }).click();
  await pack.getByRole('button', { name: 'Hunting Bow', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('cannot use');

  await panel.getByRole('tab', { name: 'Ranger' }).click();
  await pack.getByRole('button', { name: 'Hunting Bow', exact: true }).click();
  await expect(gear.getByRole('button', { name: 'Hunting Bow', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('potions go from the pack onto a belt, and Q drinks one', async ({ page }) => {
  await page.keyboard.press('i');
  const panel = page.getByRole('complementary', { name: 'Inventory' });
  const pack = panel.getByRole('list', { name: 'Pack' });
  const belt = panel.getByRole('list', { name: 'Belt' });
  await panel.getByRole('tab', { name: 'Vanguard' }).click();
  await expect(belt).toContainText('Healing Draught ×2');
  await pack.getByRole('button', { name: 'Healing Draught ×4', exact: true }).click();
  await expect(belt).toContainText('Healing Draught ×5');
  await expect(pack.getByRole('button', { name: 'Healing Draught', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('q');
  await page.keyboard.press('i');
  await expect(pack.getByRole('button', { name: /^Healing Draught/ })).toHaveCount(0);
});

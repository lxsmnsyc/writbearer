import { expect, test } from '@playwright/test';

test('at a Town well, the smith refines, and the market sells potions', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger&area=4&town');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);

  // D and S together walk east, to the well.
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  const town = page.getByRole('complementary', { name: 'Town' });
  await expect(town).toBeVisible({ timeout: 10000 });
  await page.keyboard.up('d');
  await page.keyboard.up('s');

  // The starting purse pays for a safe refine of the Vanguard's sword.
  const smith = town.getByRole('list', { name: 'Smith' });
  await smith.getByRole('button', { name: 'Refine Arming Sword' }).click();
  await expect(town.getByRole('alert')).toContainText('Arming Sword is now +1');
  await expect(smith.getByRole('button', { name: 'Refine +1 Arming Sword' })).toBeVisible();

  await town.getByRole('tab', { name: 'Market' }).click();
  await town.getByRole('button', { name: 'Buy Healing Draught' }).click();
  await expect(town.getByRole('alert')).toContainText('Bought');

  await town.getByRole('tab', { name: 'Bench' }).click();
  await expect(town.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).not.toHaveCount(
    0,
  );
});

import { expect, test } from '@playwright/test';

test('at a Waystation, the post asks wages, and the vault keeps an item', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger&area=9&station');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-bearer', /\d/);

  // D and S together walk east along the road, past the post.
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  const panel = page.getByRole('complementary', { name: 'Waystation' });
  await expect(panel).toBeVisible({ timeout: 10000 });
  await page.keyboard.up('d');
  await page.keyboard.up('s');

  const wages = panel.getByRole('region', { name: 'Wages' });
  await expect(wages.getByRole('button', { name: /^Pay / })).toHaveCount(2);
  await expect(wages).toContainText('Unpaid mercs leave the party');
  await wages.getByRole('button', { name: 'Pay Vanguard' }).click();
  await expect(wages.getByRole('button', { name: /^Pay / })).toHaveCount(1);

  const store = panel.getByRole('list', { name: 'Pack to store' });
  await store.getByRole('button', { name: /^Store Healing Draught/ }).click();
  const vault = panel.getByRole('list', { name: 'Vault' });
  await expect(vault.getByRole('button', { name: /^Take Healing Draught/ })).toBeVisible();

  // Taking the road on, the unpaid Ranger leaves the party.
  await panel.getByRole('button', { name: 'Close' }).click();
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  const party = page.getByRole('navigation', { name: 'Party' });
  await expect(party.getByRole('button')).toHaveCount(1, { timeout: 15000 });
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await expect(party.getByRole('button').first()).toContainText('Vanguard');
});

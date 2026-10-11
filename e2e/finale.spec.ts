import { expect, test } from '@playwright/test';

test('at the tomb the seal breaks, the player loses control, and the run ends', async ({
  page,
}) => {
  await page.goto('/?party=vanguard,ranger&tomb');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-finale', 'none');

  // D and S together walk east, to the sarcophagus.
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await expect(canvas).toHaveAttribute('data-finale', 'fighting', { timeout: 15000 });
  await page.keyboard.up('d');
  await page.keyboard.up('s');

  // Shouts no longer reach anyone.
  const rally = page.getByRole('navigation', { name: 'Shouts' }).getByRole('button', {
    name: 'Rally (Z)',
  });
  await page.keyboard.press('z');
  await expect(rally).toBeEnabled();

  // Mercs can still be looked at.
  await page.keyboard.press('1');
  await expect(page.getByRole('complementary', { name: 'Orders for Vanguard' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Two level 5 mercs stand no chance: the Creditor rises.
  await expect(canvas).toHaveAttribute('data-finale', 'risen', { timeout: 60000 });
});

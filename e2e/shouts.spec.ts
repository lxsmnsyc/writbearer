import { expect, test } from '@playwright/test';

test('the shout bar shows each shout, and a shout goes on cooldown', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);
  const bar = page.getByRole('navigation', { name: 'Shouts' });
  await expect(bar.getByRole('button')).toHaveCount(4);
  const rally = bar.getByRole('button', { name: 'Rally (Z)' });
  const hold = bar.getByRole('button', { name: 'Hold (C)' });
  await expect(rally).toBeEnabled();
  await page.keyboard.press('z');
  await expect(rally).toBeDisabled();
  await hold.click();
  await expect(hold).toBeDisabled();
  await expect(bar.getByRole('button', { name: 'Fall back (X)' })).toBeEnabled();
});

import { expect, test } from '@playwright/test';

test('at an Event, a choice is made and says what came of it', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger&area=4&event=toll');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);

  // D and S together walk east, to where the guard bars the road.
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  const event = page.getByRole('complementary', { name: 'The toll' });
  await expect(event).toBeVisible({ timeout: 10000 });
  await page.keyboard.up('d');
  await page.keyboard.up('s');

  await expect(event).toContainText('Old King’s guard');
  await event.getByRole('button', { name: /Pay the toll/ }).click();
  await expect(event.getByRole('status')).toContainText('step aside');

  await event.getByRole('button', { name: 'Go on' }).click();
  await expect(event).toBeHidden();
});

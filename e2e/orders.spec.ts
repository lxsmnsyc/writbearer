import { type Locator, expect, test } from '@playwright/test';

async function bearerAt(canvas: Locator): Promise<string> {
  return (await canvas.getAttribute('data-bearer')) ?? '';
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?party=vanguard,ranger');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);
});

test('1 opens the first merc orders and pauses the game', async ({ page }) => {
  const canvas = page.locator('canvas');
  await page.keyboard.press('1');
  const panel = page.getByRole('complementary', { name: 'Orders for Vanguard' });
  await expect(panel).toBeVisible();

  // Walking does nothing while paused.
  const before = await bearerAt(canvas);
  await page.keyboard.down('d');
  await page.waitForTimeout(800);
  await page.keyboard.up('d');
  expect(await bearerAt(canvas)).toBe(before);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('orders stay with the merc after the panel closes', async ({ page }) => {
  await page.keyboard.press('2');
  const panel = page.getByRole('complementary', { name: 'Orders for Ranger' });
  await panel.getByRole('radio', { name: 'Hold' }).click();
  await expect(panel.getByRole('radio', { name: 'Hold' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('Stands its ground')).toBeVisible();
  await page.keyboard.press('Escape');

  await page
    .getByRole('navigation', { name: 'Party' })
    .getByRole('button', { name: /Ranger/ })
    .click();
  await expect(panel.getByRole('radio', { name: 'Hold' })).toHaveAttribute('aria-checked', 'true');
});

test('target priorities can be removed, added and reordered', async ({ page }) => {
  await page.keyboard.press('1');
  const list = page.getByRole('list', { name: 'Target priorities' });
  await expect(list.getByRole('listitem')).toHaveText([
    /Enemies going for the bearer/,
    /Nearest enemy/,
  ]);

  await list.getByRole('listitem').nth(0).getByRole('button', { name: 'Remove' }).click();
  await expect(list.getByRole('listitem')).toHaveText([/Nearest enemy/]);

  await page.getByRole('button', { name: '+ Elites and bosses' }).click();
  await expect(list.getByRole('listitem')).toHaveText([/Nearest enemy/, /Elites and bosses/]);

  await list.getByRole('listitem').nth(1).getByRole('button', { name: 'Move up' }).click();
  await expect(list.getByRole('listitem')).toHaveText([/Elites and bosses/, /Nearest enemy/]);
});

test('clicking a merc on the canvas opens its orders', async ({ page }) => {
  // Pause at once, so the Vanguard is still at its starting spot: one tile
  // right of the bearer on screen, which the camera centers on.
  await page.keyboard.press('1');
  await page.keyboard.press('Escape');
  const box = await page.locator('canvas').boundingBox();
  if (!box) {
    throw new Error('No canvas');
  }
  await page.mouse.click(
    box.x + box.width * (0.5 + 32 / 384),
    box.y + box.height * (0.5 - 16 / 216),
  );
  await expect(page.getByRole('complementary', { name: 'Orders for Vanguard' })).toBeVisible();
});

test('each skill can be set to Auto, Elites or Off, and the setting stays', async ({ page }) => {
  await page.keyboard.press('1');
  const panel = page.getByRole('complementary', { name: 'Orders for Vanguard' });
  // Recruits arrive with points unspent: learn Challenge first.
  await panel.getByRole('tab', { name: /Skills/ }).click();
  await panel.getByRole('button', { name: /^Challenge, rank 0/ }).click();
  await expect(panel.getByRole('button', { name: /^Challenge, rank 1/ })).toBeVisible();
  await panel.getByRole('tab', { name: 'Orders' }).click();
  const challenge = panel.getByRole('radiogroup', { name: 'Use Challenge' });
  await expect(challenge.getByRole('radio', { name: 'Auto' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await challenge.getByRole('radio', { name: 'Off' }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('1');
  await expect(challenge.getByRole('radio', { name: 'Off' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('a skill needs the one before it in its branch, and its tier level', async ({ page }) => {
  await page.keyboard.press('1');
  const panel = page.getByRole('complementary', { name: 'Orders for Vanguard' });
  await panel.getByRole('tab', { name: /Skills/ }).click();
  await panel.getByRole('button', { name: /^Crush, rank 0/ }).click();
  await expect(panel.getByRole('alert')).toContainText('Needs Sunder first');
  await panel.getByRole('button', { name: /^Shield Bash, rank 0/ }).click();
  await expect(panel.getByRole('alert')).toContainText('Needs level 8');
});

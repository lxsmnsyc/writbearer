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
  await expect(wages).toContainText('Unpaid mercs lose heart');
  await wages.getByRole('button', { name: 'Pay Vanguard' }).click();
  await expect(wages.getByRole('button', { name: /^Pay / })).toHaveCount(1);

  const store = panel.getByRole('list', { name: 'Pack to store' });
  await store.getByRole('button', { name: /^Store Healing Draught/ }).click();
  const vault = panel.getByRole('list', { name: 'Vault' });
  await expect(vault.getByRole('button', { name: /^Take Healing Draught/ })).toBeVisible();

  // Walking over the north road's exit does not take it.
  // D walks north-east on the floor, then D and S together walk east.
  await panel.getByRole('button', { name: 'Close' }).click();
  const party = page.getByRole('navigation', { name: 'Party' });
  await expect(party).not.toContainText('Low morale');
  await page.keyboard.down('d');
  await expect
    .poll(async () => Number((await canvas.getAttribute('data-bearer'))?.split(',')[1]), {
      timeout: 10000,
    })
    .toBeLessThan(7.2);
  await page.keyboard.down('s');
  await expect
    .poll(async () => Number((await canvas.getAttribute('data-bearer'))?.split(',')[0]), {
      timeout: 40000,
    })
    .toBeGreaterThan(26.5);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await expect(party).not.toContainText('Low morale');

  // Clicking its plate takes it: the unpaid Ranger goes on with low morale.
  const exits = ((await canvas.getAttribute('data-exits')) ?? '').split(';');
  const [sx, sy] = exits[0].split(',').map(Number);
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('No canvas');
  }
  await page.mouse.click(box.x + sx * box.width, box.y + sy * box.height);
  await expect(party).toContainText('Low morale', { timeout: 40000 });
  await expect(party.getByRole('button')).toHaveCount(2);
});

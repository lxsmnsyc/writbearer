import { type Locator, expect, test } from '@playwright/test';

async function bearerAt(canvas: Locator): Promise<{ x: number; z: number }> {
  const value = (await canvas.getAttribute('data-bearer')) ?? '';
  const [x, z] = value.split(',').map(Number);
  return { x, z };
}

test('the stage draws without errors, and WASD walks the bearer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(m.text());
    }
  });
  await page.goto('/?party=vanguard,ranger');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-bearer', /\d/);
  const start = await bearerAt(canvas);

  // D walks right on screen, which is +x and -z on the floor.
  await page.keyboard.down('d');
  await page.waitForTimeout(1500);
  await page.keyboard.up('d');
  const end = await bearerAt(canvas);

  expect(end.x - start.x).toBeGreaterThan(1);
  expect(start.z - end.z).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('a click on the floor walks the bearer toward it', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-bearer', /\d/);
  const start = await bearerAt(canvas);
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('No canvas');
  }
  // Down from the center of the screen is +x and +z on the floor.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
  await page.waitForTimeout(1500);
  const end = await bearerAt(canvas);
  expect(end.x - start.x).toBeGreaterThan(0.5);
  expect(end.z - start.z).toBeGreaterThan(0.5);
});

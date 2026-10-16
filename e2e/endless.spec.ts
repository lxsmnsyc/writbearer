import { expect, test } from '@playwright/test';
import { titlePanel } from './support/guild';

test('endless mode is chosen at the start, and its phases are numbered', async ({ page }) => {
  await page.goto('/?seed=ASHEN');
  const picker = titlePanel(page);
  await picker.getByRole('radio', { name: 'Endless' }).click();
  await expect(picker.getByRole('radio', { name: 'Endless' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(picker).toContainText('No Writ and no ending');
  await expect(picker).toContainText('Seed ASHEN');
  await picker.getByRole('button', { name: 'Enter the Guild House' }).click();
  await page.keyboard.press('m');
  const map = page.getByRole('complementary', { name: 'Map' });
  await expect(map).toContainText('Phase 1');
  await expect(map).not.toContainText('The Marches');
});

test('an endless run goes on past where the story ends', async ({ page }) => {
  await page.goto('/?party=vanguard,ranger&endless&area=41&station');
  await expect(page.locator('canvas')).toHaveAttribute('data-bearer', /\d/);
  await page.keyboard.press('m');
  await expect(page.getByRole('complementary', { name: 'Map' })).toContainText('Phase 6');
});

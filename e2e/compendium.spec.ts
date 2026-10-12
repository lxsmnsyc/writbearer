import { expect, test } from '@playwright/test';

test('the compendium records a merc taken, and keeps it after a reload', async ({ page }) => {
  await page.goto('/?seed=ASHEN');
  const picker = page.getByRole('complementary', { name: 'Choose your first merc' });
  await picker.getByRole('button', { name: 'The Compendium (K)' }).click();
  const book = page.getByRole('complementary', { name: 'Compendium' });
  await expect(book).toBeVisible();
  await expect(book.getByRole('tab', { name: /Monsters/ })).toContainText('0 of 12');
  await book.getByRole('tab', { name: /Mercs/ }).click();
  await expect(book.getByRole('list', { name: 'Mercs' })).toContainText('Nothing yet');
  await page.keyboard.press('k');
  await expect(book).toBeHidden();

  const first = picker.getByRole('article').first();
  const name = ((await first.getAttribute('aria-label')) ?? '').split(',')[0];
  await first.getByRole('button', { name: 'Take' }).click();
  await page.keyboard.press('k');
  await book.getByRole('tab', { name: /Mercs/ }).click();
  await expect(book.getByRole('list', { name: 'Mercs' })).toContainText(name);

  // It is written a moment after a discovery.
  await expect
    .poll(
      async () => {
        await page.reload();
        await page.keyboard.press('k');
        await page
          .getByRole('complementary', { name: 'Compendium' })
          .getByRole('tab', { name: /Mercs/ })
          .click();
        return page.getByRole('list', { name: 'Mercs' }).textContent();
      },
      { timeout: 15000 },
    )
    .toContain(name);
});

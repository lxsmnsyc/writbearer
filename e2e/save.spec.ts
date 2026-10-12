import { expect, test } from '@playwright/test';

test('a run is saved as it begins, and can be continued after a reload', async ({ page }) => {
  await page.goto('/?seed=ASHEN');
  const picker = page.getByRole('complementary', { name: 'Choose your first merc' });
  await expect(picker.getByRole('button', { name: /Continue the last run/ })).toHaveCount(0);
  const first = picker.getByRole('article').first();
  const name = ((await first.getAttribute('aria-label')) ?? '').split(',')[0];
  await first.getByRole('button', { name: 'Take' }).click();
  await expect(picker).toBeHidden();

  // The save is written in the background; wait until the slot holds it.
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          new Promise<string | null>((resolve) => {
            const open = indexedDB.open('writbearer', 1);
            open.onsuccess = () => {
              const get = open.result
                .transaction('run', 'readonly')
                .objectStore('run')
                .get('suspended');
              get.onsuccess = () => {
                const save: unknown = get.result;
                resolve(
                  typeof save === 'object' && save !== null && 'seed' in save
                    ? String(save.seed)
                    : null,
                );
              };
              get.onerror = () => {
                resolve(null);
              };
            };
            open.onerror = () => {
              resolve(null);
            };
          }),
      ),
    )
    .toBe('ASHEN');

  await page.goto('/');
  const resume = page
    .getByRole('complementary', { name: 'Choose your first merc' })
    .getByRole('button', { name: /Continue the last run/ });
  await expect(resume).toContainText('Seed ASHEN');
  await expect(resume).toContainText('The Marches, area 1');
  await resume.click();
  await expect(picker).toBeHidden();
  const party = page.getByRole('navigation', { name: 'Party' });
  await expect(party.getByRole('button')).toHaveCount(1);
  await expect(party.getByRole('button').first()).toContainText(name);
});

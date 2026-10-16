import { expect, test } from '@playwright/test';
import { enterGuild, hire, recruits, titlePanel } from './support/guild';

test('a run is saved as it enters the first area, and can be continued after a reload', async ({
  page,
}) => {
  await page.goto('/?seed=ASHEN');
  await expect(titlePanel(page).getByRole('button', { name: /Continue the last run/ })).toHaveCount(
    0,
  );
  await enterGuild(page);
  const fighter = (await recruits(page)).find((r) => r.kind !== 'cleric')!;
  const name = fighter.name;
  await hire(page, fighter);

  // The road out of the Guild House: walk east, then click its plate.
  const canvas = page.locator('canvas');
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await expect
    .poll(async () => Number((await canvas.getAttribute('data-bearer'))?.split(',')[0]), {
      timeout: 15000,
    })
    .toBeGreaterThan(20);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  const box = (await canvas.boundingBox())!;
  await expect
    .poll(
      async () => {
        const exits = ((await canvas.getAttribute('data-exits')) ?? '').split(';');
        const [sx, sy] = exits[0].split(',').map(Number);
        await page.mouse.click(box.x + sx * box.width, box.y + sy * box.height);
        return (await canvas.getAttribute('data-recruits')) ?? '';
      },
      { timeout: 30000 },
    )
    .toBe('');

  // The save is written in the background; wait until the slot holds it.
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          new Promise<string | null>((resolve) => {
            const open = indexedDB.open('writbearer', 2);
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
  const resume = titlePanel(page).getByRole('button', { name: /Continue the last run/ });
  await expect(resume).toContainText('Seed ASHEN');
  await expect(resume).toContainText('The Marches, area 1');
  await resume.click();
  await expect(titlePanel(page)).toBeHidden();
  const party = page.getByRole('navigation', { name: 'Party' });
  await expect(party.getByRole('button')).toHaveCount(1);
  await expect(party.getByRole('button').first()).toContainText(name);
});

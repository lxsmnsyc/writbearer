import { type Page, expect } from '@playwright/test';

// The Guild House, where a run begins: the title panel, the recruits
// waiting there, and hiring them by walking the bearer up to each.

export interface Recruit {
  name: string;
  kind: string;
  x: number;
  y: number;
}

/** The title panel of a new run. */
export const titlePanel = (page: Page): ReturnType<Page['getByRole']> =>
  page.getByRole('complementary', { name: 'A new run' });

/** The recruits waiting, as the canvas publishes them. */
export async function recruits(page: Page): Promise<Recruit[]> {
  const value = (await page.locator('canvas').getAttribute('data-recruits')) ?? '';
  return value
    .split(';')
    .filter(Boolean)
    .map((r) => {
      const [who, at] = r.split(':');
      const [name, kind] = who.split('/');
      const [x, y] = at.split(',').map(Number);
      return { name, kind, x, y };
    });
}

/** Opens a run at a seed and walks into the Guild House. */
export async function enterGuild(page: Page, url = '/?seed=ASHEN'): Promise<void> {
  await page.goto(url);
  await titlePanel(page).getByRole('button', { name: 'Enter the Guild House' }).click();
  await expect(titlePanel(page)).toBeHidden();
  await expect.poll(async () => (await recruits(page)).length).toBeGreaterThan(0);
}

/** Walks the bearer to a recruit until it talks. Returns its dialog. */
export async function talkTo(page: Page, recruit: Recruit): Promise<ReturnType<Page['getByRole']>> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) {
    throw new Error('No canvas');
  }
  // Fresh, since the camera moves as the bearer walks. One off the screen
  // is walked toward first.
  const find = async (): Promise<Recruit> =>
    (await recruits(page)).find((r) => r.name === recruit.name) ?? recruit;
  let at = await find();
  for (let i = 0; i < 10 && (at.x > 0.95 || at.x < 0.05); i++) {
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    at = await find();
  }
  await page.mouse.click(box.x + at.x * box.width, box.y + at.y * box.height);
  const dialog = page.getByRole('complementary', { name: 'A merc for hire' });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  return dialog;
}

/** Walks the bearer to a recruit and hires it. */
export async function hire(page: Page, recruit: Recruit): Promise<void> {
  const dialog = await talkTo(page, recruit);
  await dialog.getByRole('button', { name: /Take|Hire/ }).click();
  await expect(dialog).toBeHidden();
}

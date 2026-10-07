// Takes a screenshot of the voxel proof.
// Run the dev server first: pnpm exec vite --port 5198
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 864 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5198/experiments/voxel/index.html');
await page.waitForFunction(() => window.ready === true, null, { timeout: 30_000 });
await page.waitForTimeout(1500);
await page.locator('canvas').screenshot({ path: new URL('./proof.png', import.meta.url).pathname });
await browser.close();
if (errors.length) console.log(errors.join('\n'));
console.log('saved');

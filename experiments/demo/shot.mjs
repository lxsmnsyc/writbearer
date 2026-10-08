// Plays the demo for a few seconds and takes screenshots along the way.
// Run the dev server first: pnpm exec vite --port 5198
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5198/experiments/demo/index.html');
await page.waitForFunction(() => window.ready === true, null, { timeout: 15_000 });
const shot = (name) => page.locator('canvas').screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname });
await page.waitForTimeout(1500);
await shot('demo-1');
// Walk toward the altar to wake the cultists.
await page.keyboard.down('d');
await page.waitForTimeout(3800);
await page.keyboard.up('d');
await page.waitForTimeout(1200);
await shot('demo-2');
await page.waitForTimeout(2500);
await shot('demo-3');
await page.waitForTimeout(5000);
await shot('demo-4');
await browser.close();
if (errors.length) console.log(errors.join('\n'));
console.log('saved');

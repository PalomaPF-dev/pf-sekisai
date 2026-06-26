// App Store 用 iPad スクリーンショットを Chrome(headless) で撮影する。
// 横向き iPad Pro 12.9"(2732x2048) = viewport 1366x1024 @ DPR2。
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'ipad');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4599';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1366, H = 1024, DSF = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ['--no-sandbox', '--hide-scrollbars', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: DSF },
});
const page = await browser.newPage();

async function shot(name, scrollY = 0) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await sleep(500);
  await page.screenshot({ path: join(OUT, name) });
  console.log('SHOT', name);
}

await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await page.evaluate(async () => {
  localStorage.setItem('truckloader.dataSource', 'local');
  const dbs = (await (indexedDB.databases ? indexedDB.databases() : [])) || [];
  for (const d of dbs) if (d.name) indexedDB.deleteDatabase(d.name);
});
await sleep(800);
await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await sleep(1500);
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /サンプルで始める/.test(x.textContent));
  if (b) { b.click(); return true; }
  return false;
});
console.log('sample clicked =', clicked);
await sleep(3000);

await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await sleep(1800);
await shot('01_dashboard.png');

await page.goto(`${BASE}/loading-plan.html?view=plan`, { waitUntil: 'networkidle2' });
await sleep(2500);
await shot('02_truck_layout.png');

await page.goto(`${BASE}/loading-plan.html`, { waitUntil: 'networkidle2' });
await sleep(2200);
await shot('03_schedule.png');

await page.goto(`${BASE}/inventory.html`, { waitUntil: 'networkidle2' });
await sleep(2000);
await shot('04_inventory.png');

await page.goto(`${BASE}/production.html`, { waitUntil: 'networkidle2' });
await sleep(2000);
await shot('05_production.png', 420);

await browser.close();
console.log('DONE');

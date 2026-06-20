// ドライバー配布用PDF（印刷ドキュメント）全体の参考画像を再生成。
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'driver_pdf_full_reference.png');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:4599';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox'], defaultViewport: { width: 900, height: 700, deviceScaleFactor: 2 },
});
const p = await browser.newPage();
await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await p.evaluate(async () => {
  localStorage.setItem('truckloader.dataSource', 'local');
  const d = (await (indexedDB.databases ? indexedDB.databases() : [])) || [];
  for (const x of d) if (x.name) indexedDB.deleteDatabase(x.name);
});
await sleep(700);
await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await sleep(1500);
await p.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /サンプルで始める/.test(e.textContent));
  if (x) x.click();
});
await sleep(2500);
await p.goto(`${BASE}/loading-plan.html?view=plan`, { waitUntil: 'networkidle2' });
await sleep(2500);
await p.evaluate(() => {
  const w = document.querySelector('[aria-hidden] > div');
  const h = w.parentElement;
  h.style.position = 'static';
  h.style.left = '0';
  w.style.background = '#fff';
  w.id = '__pdfwrap';
});
await sleep(400);
// ヘッダーだけの確認用も保存
const hdr = await p.$('#__pdfwrap > div:first-child > div:first-child');
if (hdr) await hdr.screenshot({ path: '/tmp/pdf_header.png' });
const wrap = await p.$('#__pdfwrap');
if (wrap) await wrap.screenshot({ path: OUT });
await browser.close();
console.log('DONE pdf ref + header');

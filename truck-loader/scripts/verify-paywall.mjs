// ペイウォールの実挙動を検証：無料状態で「印刷・PDF」を押すとアップグレードモーダルが出るか。
import puppeteer from 'puppeteer-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:4611';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox'], defaultViewport: { width: 1434, height: 660, deviceScaleFactor: 1 },
});
const page = await browser.newPage();

// 初期化＋サンプル投入
await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await page.evaluate(async () => {
  localStorage.setItem('truckloader.dataSource', 'local');
  const dbs = (await (indexedDB.databases ? indexedDB.databases() : [])) || [];
  for (const d of dbs) if (d.name) indexedDB.deleteDatabase(d.name);
});
await sleep(700);
await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
await sleep(1500);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /サンプルで始める/.test(x.textContent));
  if (b) b.click();
});
await sleep(2500);

// 積載計画（積載計画ビュー）へ
await page.goto(`${BASE}/loading-plan.html?view=plan`, { waitUntil: 'networkidle2' });
await sleep(2500);

const isProFlag = await page.evaluate(() => localStorage.getItem('truckloader.isPro'));

// 「印刷・PDF」ボタンをクリック
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /印刷・PDF/.test(x.textContent));
  if (b) { b.click(); return true; }
  return false;
});
await sleep(1200);

const modal = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    hasUpgradeTitle: /プロにアップグレード/.test(txt),
    hasFeatureMsg: /はプロ機能です/.test(txt),
    hasWebMsg: /iOS ?アプリから/.test(txt),
    pdfFeature: /「PDF出力」/.test(txt),
  };
});

console.log(JSON.stringify({ isProFlag, pdfClicked: clicked, ...modal }, null, 2));
await browser.close();

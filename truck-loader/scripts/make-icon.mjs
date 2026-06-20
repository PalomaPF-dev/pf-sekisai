// App アイコン(1024x1024, アルファ無し)を Chrome headless で生成する。
// アプリ内ロゴ（青背景＋白トラック）に合わせたフルブリードのデザイン。
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'AppIcon-1024.png');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  .icon{width:1024px;height:1024px;background:linear-gradient(145deg,#3b82f6 0%,#2563eb 55%,#1d4ed8 100%);display:flex;align-items:center;justify-content:center}
  svg{width:600px;height:600px}
</style></head><body>
  <div class="icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1.2"></rect>
      <path d="M16 8h4l3 3v5h-7V8z"></path>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>
  </div>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1024, height: 1024, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
const el = await page.$('.icon');
await el.screenshot({ path: OUT, omitBackground: false });
await browser.close();
console.log('ICON', OUT);

// iOS 起動スプラッシュ（2732x2732・α無し）を生成。グラデ背景＋「ス」マーク＋ワードマーク。
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'ios/App/App/Assets.xcassets/Splash.imageset');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const JP = `'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif`;

const html = `<!doctype html><html><head><meta charset=utf-8><style>html,body{margin:0;padding:0}</style></head>
<body>
  <div style="width:2732px;height:2732px;background:linear-gradient(135deg,#6366f1 0%,#3b82f6 50%,#06b6d4 100%);display:flex;flex-direction:column;align-items:center;justify-content:center">
    <span style="font-family:${JP};font-weight:900;font-size:900px;color:#fff;line-height:1;letter-spacing:-20px;margin-bottom:40px">ス</span>
    <span style="font-family:${JP};font-weight:800;font-size:180px;color:#fff;letter-spacing:8px">スマコウバ積載</span>
  </div>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 2732, height: 2732, deviceScaleFactor: 1 },
});
const p = await browser.newPage();
await p.setContent(html, { waitUntil: 'networkidle0' });
const el = await p.$('div');
await el.screenshot({ path: join(OUT, 'splash-2732x2732.png'), omitBackground: false });
await browser.close();
console.log('SPLASH base done');

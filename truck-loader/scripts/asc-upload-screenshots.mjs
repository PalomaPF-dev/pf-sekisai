// 指定ディレクトリの PNG を、指定 displayType のスクショセットにアップロードする。
// 使い方: node scripts/asc-upload-screenshots.mjs <displayType> <dir>
import { api, G, APP_ID } from './asc-lib.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const DISPLAY = process.argv[2] || 'APP_IPAD_PRO_3GEN_129';
const DIR = process.argv[3] || 'screenshots/ipad';
const LOCALE = 'ja';

const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data[0];
const vls = await G(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
const vl = (vls.data || []).find(l => l.attributes.locale === LOCALE) || vls.data[0];
console.log('versionLocalization:', vl.id, vl.attributes.locale);

// 既存セット確認
const existingSets = await G(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets?include=appScreenshots`);
let set = (existingSets.data || []).find(s => s.attributes.screenshotDisplayType === DISPLAY);
if (set) {
  const cnt = (set.relationships?.appScreenshots?.data || []).length;
  console.log('既存セットあり:', set.id, 'screenshots:', cnt);
  if (cnt >= 3) { console.log('既に十分な枚数 → スキップ'); process.exit(0); }
} else {
  const r = await api('POST', '/v1/appScreenshotSets', {
    data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: DISPLAY },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vl.id } } } },
  });
  set = r.data;
  console.log('✅ スクショセット作成:', set.id, DISPLAY);
}

const files = readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
for (const fn of files) {
  const buf = readFileSync(join(DIR, fn));
  const md5 = createHash('md5').update(buf).digest('hex');
  // 1) 予約
  const created = await api('POST', '/v1/appScreenshots', {
    data: { type: 'appScreenshots', attributes: { fileName: fn, fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
  });
  const sid = created.data.id;
  const ops = created.data.attributes.uploadOperations || [];
  // 2) アップロード（各オペレーション）
  for (const op of ops) {
    const headers = {};
    for (const h of op.requestHeaders || []) headers[h.name] = h.value;
    const slice = buf.subarray(op.offset, op.offset + op.length);
    const r = await fetch(op.url, { method: op.method || 'PUT', headers, body: slice });
    if (!r.ok) { console.log('❌ PUT失敗', fn, r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  }
  // 3) コミット
  await api('PATCH', `/v1/appScreenshots/${sid}`, {
    data: { type: 'appScreenshots', id: sid, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  console.log('✅ uploaded', fn, `(${buf.length}B, ${ops.length}ops)`);
}
console.log('done', DISPLAY);

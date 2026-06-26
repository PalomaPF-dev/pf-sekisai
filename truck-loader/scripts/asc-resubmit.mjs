import { api, G, APP_ID } from './asc-lib.mjs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1) build 2 が VALID になるまで待つ
let build = null;
for (let i = 0; i < 40; i++) {
  const bs = await G(`/v1/builds?filter[app]=${APP_ID}&filter[version]=2&limit=1`);
  build = bs.data?.[0];
  const st = build?.attributes?.processingState;
  console.log(`build2 processing: ${st || 'まだ未表示'} (try ${i + 1})`);
  if (st === 'VALID') break;
  if (st === 'INVALID' || st === 'FAILED') { console.log('❌ build2 が無効化されました'); process.exit(1); }
  await sleep(15000);
}
if (build?.attributes?.processingState !== 'VALID') { console.log('build2 がまだVALIDではありません。後で再実行してください。'); process.exit(1); }
console.log('✅ build2 VALID:', build.id);

// 2) 輸出コンプライアンス
await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
console.log('✅ build2 暗号化=No');

// 3) version に build2 を紐付け
const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data[0];
await api('PATCH', `/v1/appStoreVersions/${ver.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
console.log('✅ version 1.0 に build2 を紐付け');

// 4) 旧提出（却下/未解決）をキャンセル
const subs = await G(`/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=20`);
for (const s of subs.data || []) {
  if (['UNRESOLVED_ISSUES', 'READY_FOR_REVIEW'].includes(s.attributes.state)) {
    try { await api('PATCH', `/v1/reviewSubmissions/${s.id}`, { data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } }); console.log('旧提出をキャンセル:', s.id, s.attributes.state); }
    catch (e) { console.log('キャンセル不可:', s.id, String(e.message).split('\n')[0]); }
  }
}
await sleep(3000);

// 5) 新規提出
const created = await api('POST', '/v1/reviewSubmissions', {
  data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
});
const sub = created.data;
console.log('✅ 新規 reviewSubmission:', sub.id, sub.attributes.state);

await api('POST', '/v1/reviewSubmissionItems', {
  data: { type: 'reviewSubmissionItems', relationships: {
    reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
    appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
  } },
});
console.log('✅ バージョンを項目追加');

const res = await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
console.log('🎉 提出 state:', res.data?.attributes?.state);

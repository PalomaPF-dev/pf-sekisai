import { api, G, APP_ID } from './asc-lib.mjs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1) build 3 が VALID になるまで待つ
let build = null;
for (let i = 0; i < 50; i++) {
  const bs = await G(`/v1/builds?filter[app]=${APP_ID}&filter[version]=3&limit=1`);
  build = bs.data?.[0];
  const st = build?.attributes?.processingState;
  console.log(`build3 processing: ${st || '未表示'} (try ${i + 1})`);
  if (st === 'VALID') break;
  if (st === 'INVALID' || st === 'FAILED') { console.log('❌ build3 無効'); process.exit(1); }
  await sleep(15000);
}
if (build?.attributes?.processingState !== 'VALID') { console.log('build3 まだVALIDでない。後で再実行。'); process.exit(1); }
console.log('✅ build3 VALID:', build.id);

// 2) 暗号化=No
await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
console.log('✅ 暗号化=No');

// 3) version に build3 を紐付け
const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data[0];
await api('PATCH', `/v1/appStoreVersions/${ver.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
console.log('✅ build3 紐付け');

// 4) 審査メモを今回の指摘対応で更新
const NOTES = `本アプリは中小製造業/物流向けのトラック積載計画ツールです（無料・アプリ内課金なし）。

[3.1.1について] iOSアプリ内には有料購入・サブスクリプション・外部決済への導線はありません。ログイン後は全機能を制限なくご利用いただけます（料金/お問い合わせ等の外部課金ページはネイティブでは表示しません）。

[2.1(a) ログイン時ネットワークエラーについて] 前回のエラーはサーバ側CORS設定の不備が原因でした。修正済みで、本ビルドではログイン/新規登録が正常に動作します（インターネット接続が必要）。

審査用デモアカウント: appreview@example.com / appreview
※登録せずに確認する場合は、ログイン画面の「ログインせずにデモを見る」からサンプルデータで全機能を確認できます。
カメラはバーコード/QR照合のみに使用し、画像は端末内で処理します。画面は横向き固定です。`;
try {
  const rd = await G(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`);
  if (rd.data) {
    await api('PATCH', `/v1/appStoreReviewDetails/${rd.data.id}`, { data: { type: 'appStoreReviewDetails', id: rd.data.id, attributes: { notes: NOTES } } });
    console.log('✅ 審査メモ更新');
  }
} catch (e) { console.log('審査メモ更新スキップ:', String(e.message).split('\n')[0]); }

// 5) 旧提出(却下/未解決/準備中)をキャンセル
const subs = await G(`/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=20`);
for (const s of subs.data || []) {
  if (['UNRESOLVED_ISSUES', 'READY_FOR_REVIEW', 'WAITING_FOR_REVIEW'].includes(s.attributes.state)) {
    try { await api('PATCH', `/v1/reviewSubmissions/${s.id}`, { data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } }); console.log('旧提出キャンセル:', s.id, s.attributes.state); }
    catch (e) { console.log('キャンセル不可:', s.id, String(e.message).split('\n')[0]); }
  }
}
await sleep(3000);

// 6) 新規提出
const created = await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } } });
const sub = created.data;
console.log('✅ 新規submission:', sub.id, sub.attributes.state);
await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
console.log('✅ バージョン項目追加');
const res = await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
console.log('🎉 提出 state:', res.data?.attributes?.state);

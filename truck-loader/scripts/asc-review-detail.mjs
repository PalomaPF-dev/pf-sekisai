import { api, G, APP_ID } from './asc-lib.mjs';

const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data[0];

const NOTES = `本アプリは中小製造業/物流向けのトラック積載計画ツールです。
・ログイン後30日間の無料トライアルで全機能を利用できます（アプリ内課金はありません。継続利用は法人契約・アプリ外決済）。
・初回はログインまたは新規登録が必要です。審査用のデモアカウントを用意しています（下記）。
・登録せずに確認する場合は、ログイン画面の「ログインせずにデモを見る」からサンプルデータで全機能を確認できます。
・カメラはバーコード/QRの照合のみに使用し、画像は端末内で処理します。画面は横向き表示に最適化しています。
デモアカウント: appreview@example.com / appreview`;

const attributes = {
  contactFirstName: 'Tetsuya',
  contactLastName: 'Yasuda',
  contactEmail: 'sophie83101028@gmail.com',
  demoAccountName: 'appreview@example.com',
  demoAccountPassword: 'appreview',
  demoAccountRequired: true,
  notes: NOTES,
};

// 既存があればPATCH、無ければPOST
let existing = null;
try { const r = await G(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`); existing = r.data; } catch { /* none */ }

try {
  if (existing) {
    await api('PATCH', `/v1/appStoreReviewDetails/${existing.id}`, { data: { type: 'appStoreReviewDetails', id: existing.id, attributes } });
    console.log('✅ 審査情報を更新:', existing.id);
  } else {
    const res = await api('POST', '/v1/appStoreReviewDetails', {
      data: { type: 'appStoreReviewDetails', attributes, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } },
    });
    console.log('✅ 審査情報を作成:', res.data?.id);
  }
} catch (e) {
  console.log('❌ 審査情報:', String(e.message));
}

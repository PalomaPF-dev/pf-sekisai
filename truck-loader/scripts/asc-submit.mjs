import { api, G, APP_ID } from './asc-lib.mjs';

const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data[0];
console.log('version', ver.id, ver.attributes.appStoreState ?? ver.attributes.appVersionState);

// 既存の未完了レビュー提出を探す
let sub = null;
try {
  const subs = await G(`/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=20`);
  sub = (subs.data || []).find(s => ['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES', 'COMPLETING'].includes(s.attributes.state) === false && s.attributes.state !== 'COMPLETE') || null;
  // より単純に: state が DRAFT/READY 系の編集可能なもの
  sub = (subs.data || []).find(s => ['READY_FOR_REVIEW'].includes(s.attributes.state) || s.attributes.state === 'UNRESOLVED_ISSUES') || sub;
  console.log('既存submissions:', (subs.data || []).map(s => `${s.id}:${s.attributes.state}`).join(', ') || 'なし');
} catch (e) { console.log('submissions取得:', String(e.message).split('\n')[0]); }

// 編集可能な提出が無ければ新規作成
let editable = null;
try {
  const subs = await G(`/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=20`);
  editable = (subs.data || []).find(s => ['READY_FOR_REVIEW'].includes(s.attributes.state));
} catch {}

if (!editable) {
  try {
    const res = await api('POST', '/v1/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
    });
    editable = res.data;
    console.log('✅ reviewSubmission作成:', editable.id, editable.attributes.state);
  } catch (e) { console.log('❌ reviewSubmission作成:', String(e.message)); process.exit(1); }
}

// バージョンを項目として追加（既存項目があればスキップ）
try {
  const items = await G(`/v1/reviewSubmissions/${editable.id}/items`);
  const has = (items.data || []).some(i => i.relationships?.appStoreVersion?.data?.id === ver.id);
  if (!has) {
    await api('POST', '/v1/reviewSubmissionItems', {
      data: { type: 'reviewSubmissionItems', relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: editable.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
      } },
    });
    console.log('✅ 提出項目にバージョン追加');
  } else { console.log('提出項目に既にバージョンあり'); }
} catch (e) { console.log('❌ 項目追加:', String(e.message)); }

// 提出（submitted=true）
try {
  const res = await api('PATCH', `/v1/reviewSubmissions/${editable.id}`, {
    data: { type: 'reviewSubmissions', id: editable.id, attributes: { submitted: true } },
  });
  console.log('🎉 提出完了 state:', res.data?.attributes?.state);
} catch (e) {
  console.log('⛔ 提出時の検証エラー（要対応）:\n', String(e.message));
}

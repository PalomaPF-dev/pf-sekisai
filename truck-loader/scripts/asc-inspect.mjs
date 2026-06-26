import { G, APP_ID } from './asc-lib.mjs';

const out = {};

// アプリ + バージョン
const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data?.[0];
out.version = ver && { id: ver.id, versionString: ver.attributes.versionString, state: ver.attributes.appStoreState ?? ver.attributes.appVersionState, releaseType: ver.attributes.releaseType };

if (ver) {
  // バージョンローカライズ（説明/キーワード等）
  const vl = await G(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
  out.versionLocalizations = (vl.data || []).map(l => ({
    id: l.id, locale: l.attributes.locale,
    description: l.attributes.description ? `(${l.attributes.description.length}字)` : null,
    keywords: l.attributes.keywords || null,
    promotionalText: l.attributes.promotionalText ? `(${l.attributes.promotionalText.length}字)` : null,
    supportUrl: l.attributes.supportUrl, marketingUrl: l.attributes.marketingUrl, whatsNew: l.attributes.whatsNew,
  }));
  // スクリーンショット
  const jaVl = (vl.data || []).find(l => l.attributes.locale === 'ja') || vl.data?.[0];
  if (jaVl) {
    const sets = await G(`/v1/appStoreVersionLocalizations/${jaVl.id}/appScreenshotSets?include=appScreenshots`);
    out.screenshotSets = (sets.data || []).map(s => ({
      type: s.attributes.screenshotDisplayType,
      count: (s.relationships?.appScreenshots?.data || []).length,
    }));
  }
  // ビルド紐付け
  try { const b = await G(`/v1/appStoreVersions/${ver.id}/build`); out.build = b.data && { id: b.data.id }; }
  catch { out.build = null; }
  // 審査情報
  try { const rd = await G(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`); out.reviewDetail = rd.data && { ...rd.data.attributes }; }
  catch { out.reviewDetail = null; }
  // 輸出コンプライアンス（build属性）
  try {
    const bs = await G(`/v1/builds?filter[app]=${APP_ID}&filter[version]=1&limit=1`);
    out.buildEncryption = bs.data?.[0] && { id: bs.data[0].id, usesNonExemptEncryption: bs.data[0].attributes.usesNonExemptEncryption, processingState: bs.data[0].attributes.processingState };
  } catch (e) { out.buildEncryption = String(e).slice(0,200); }
}

// appInfo（名前・サブタイトル・カテゴリ・年齢）
const infos = await G(`/v1/apps/${APP_ID}/appInfos?include=appInfoLocalizations,primaryCategory,secondaryCategory`);
const info = infos.data?.[0];
out.appInfo = info && {
  id: info.id, state: info.attributes.appStoreState ?? info.attributes.state,
  primaryCategory: info.relationships?.primaryCategory?.data?.id || null,
  secondaryCategory: info.relationships?.secondaryCategory?.data?.id || null,
};
if (info) {
  const il = await G(`/v1/appInfos/${info.id}/appInfoLocalizations`);
  out.appInfoLocalizations = (il.data || []).map(l => ({ id: l.id, locale: l.attributes.locale, name: l.attributes.name, subtitle: l.attributes.subtitle }));
  try { const ar = await G(`/v1/appInfos/${info.id}/ageRatingDeclaration`); out.ageRating = ar.data && { id: ar.data.id, ...ar.data.attributes }; }
  catch { out.ageRating = null; }
}

// 価格スケジュール
try {
  const ps = await G(`/v1/apps/${APP_ID}/appPriceSchedule?include=manualPrices,baseTerritory`);
  out.priceSchedule = ps.data ? { id: ps.data.id, manualPrices: (ps.included||[]).filter(x=>x.type==='appPrices').length } : 'none';
} catch (e) { out.priceSchedule = String(e).slice(0, 160); }

// App privacy 公開状態
try { const du = await G(`/v1/apps/${APP_ID}/appDataUsagePublishState`); out.privacyPublished = du.data?.attributes?.published; }
catch (e) { out.privacyPublished = String(e).slice(0, 160); }

console.log(JSON.stringify(out, null, 2));

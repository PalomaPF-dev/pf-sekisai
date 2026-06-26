import { api, G, APP_ID } from './asc-lib.mjs';

const step = async (label, fn) => {
  try { await fn(); console.log('✅', label); }
  catch (e) { console.log('❌', label, '\n  ', String(e.message || e).replace(/\n/g, '\n   ')); }
};

// --- IDs取得 ---
const versions = await G(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const ver = (versions.data || []).find(v => v.attributes.versionString === '1.0') || versions.data[0];
const infos = await G(`/v1/apps/${APP_ID}/appInfos`);
const info = infos.data[0];
const il = await G(`/v1/appInfos/${info.id}/appInfoLocalizations`);
const jaInfo = il.data.find(l => l.attributes.locale === 'ja');
const builds = await G(`/v1/builds?filter[app]=${APP_ID}&filter[version]=1&limit=1`);
const build = builds.data[0];

console.log('version', ver.id, '| appInfo', info.id, '| jaInfoLoc', jaInfo.id, '| build', build.id);

// 1) サブタイトル
await step('サブタイトル', () => api('PATCH', `/v1/appInfoLocalizations/${jaInfo.id}`, {
  data: { type: 'appInfoLocalizations', id: jaInfo.id, attributes: { subtitle: 'トラック積載の計画・可視化・指示' } },
}));

// 2) カテゴリ（主: ビジネス / 副: 仕事効率化）
await step('プライマリカテゴリ=BUSINESS', () => api('PATCH', `/v1/appInfos/${info.id}`, {
  data: {
    type: 'appInfos', id: info.id,
    relationships: {
      primaryCategory: { data: { type: 'appCategories', id: 'BUSINESS' } },
      secondaryCategory: { data: { type: 'appCategories', id: 'PRODUCTIVITY' } },
    },
  },
}));

// 3) 年齢レーティング（全項目なし → 4+）
await step('年齢レーティング(4+)', () => api('PATCH', `/v1/ageRatingDeclarations/${info.id}`, {
  data: {
    type: 'ageRatingDeclarations', id: info.id,
    attributes: {
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      horrorOrFearThemes: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      sexualContentOrNudity: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      gamblingSimulated: 'NONE',
      contests: 'NONE',
      gambling: false,
      unrestrictedWebAccess: false,
      lootBox: false,
      kidsAgeBand: null,
    },
  },
}));

// 4) 輸出コンプライアンス: 非該当の暗号化(標準HTTPSのみ) → usesNonExemptEncryption=false
await step('輸出コンプライアンス(暗号化=No)', () => api('PATCH', `/v1/builds/${build.id}`, {
  data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
}));

// 5) ビルドをバージョンに紐付け
await step('ビルド紐付け', () => api('PATCH', `/v1/appStoreVersions/${ver.id}/relationships/build`, {
  data: { type: 'builds', id: build.id },
}));

console.log('done');

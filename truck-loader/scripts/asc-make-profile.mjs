// truckloader 用 App Store プロビジョニングプロファイルを API で作成（既存配信証明書を使用）。
import { readFileSync, writeFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const KEY_ID = 'PABJUM2FM4';
const ISSUER = 'b495bc82-4182-4292-8e58-938b378a2e4d';
const P8 = process.env.HOME + '/.appstoreconnect/private_keys/AuthKey_PABJUM2FM4.p8';
const BUNDLE = 'com.tetsuyayasuda.truckloader';
const CERT_ID = 'R6X9DD2J4G'; // IOS_DISTRIBUTION
const PROFILE_NAME = 'Sumakouba TruckLoader AppStore';
const OUT = process.argv[2] || 'build/truckloader_appstore.mobileprovision';

const key = await importPKCS8(readFileSync(P8, 'utf8'), 'ES256');
async function jwt() {
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
    .setIssuer(ISSUER).setIssuedAt().setExpirationTime('18m').setAudience('appstoreconnect-v1').sign(key);
}
async function api(path, init = {}) {
  const t = await jwt();
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, json, text };
}

// 1) bundleId リソースID取得
const b = await api(`/v1/bundleIds?filter[identifier]=${BUNDLE}`);
const bundleId = b.json?.data?.[0]?.id;
if (!bundleId) { console.error('bundleId not found', b.status, b.text.slice(0, 300)); process.exit(1); }
console.log('bundleId resource:', bundleId);

// 2) 既存の同名/同バンドルのApp Storeプロファイルを探す
const list = await api('/v1/profiles?limit=100&include=bundleId');
let prof = (list.json?.data ?? []).find(p =>
  p.attributes?.profileType === 'IOS_APP_STORE' &&
  (p.attributes?.name === PROFILE_NAME || p.relationships?.bundleId?.data?.id === bundleId)
);

if (prof) {
  console.log('既存プロファイルを再利用:', prof.id, prof.attributes?.name, prof.attributes?.profileState);
  // profileContent を取りに行く（単体GET）
  const one = await api(`/v1/profiles/${prof.id}`);
  prof = one.json?.data ?? prof;
} else {
  // 3) 新規作成
  const body = {
    data: {
      type: 'profiles',
      attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundleId } },
        certificates: { data: [{ type: 'certificates', id: CERT_ID }] },
      },
    },
  };
  const c = await api('/v1/profiles', { method: 'POST', body: JSON.stringify(body) });
  if (c.status !== 201) { console.error('profile create failed', c.status, c.text.slice(0, 600)); process.exit(1); }
  prof = c.json.data;
  console.log('プロファイル作成:', prof.id, prof.attributes?.name);
}

const content = prof.attributes?.profileContent;
if (!content) { console.error('no profileContent'); process.exit(1); }
writeFileSync(OUT, Buffer.from(content, 'base64'));
console.log('saved:', OUT);
console.log('PROFILE_NAME=' + (prof.attributes?.name || PROFILE_NAME));
console.log('PROFILE_UUID=' + (prof.attributes?.uuid || ''));

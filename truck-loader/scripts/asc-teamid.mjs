// App Store Connect API キーで JWT を作り、bundleId の seedId(=Team ID) を取得する。
import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const KEY_ID = 'PABJUM2FM4';
const ISSUER = 'b495bc82-4182-4292-8e58-938b378a2e4d';
const P8 = process.env.HOME + '/.appstoreconnect/private_keys/AuthKey_PABJUM2FM4.p8';
const BUNDLE = 'com.tetsuyayasuda.truckloader';

const pkcs8 = readFileSync(P8, 'utf8');
const key = await importPKCS8(pkcs8, 'ES256');
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  .setIssuer(ISSUER)
  .setIssuedAt()
  .setExpirationTime('18m')
  .setAudience('appstoreconnect-v1')
  .sign(key);

const headers = { Authorization: `Bearer ${jwt}` };

// bundleId 一覧（seedId=Team ID を含む）
const r = await fetch(`https://api.appstoreconnect.apple.com/v1/bundleIds?filter[identifier]=${BUNDLE}&limit=10`, { headers });
const j = await r.json();
if (!r.ok) { console.error('API error', r.status, JSON.stringify(j)); process.exit(1); }
for (const b of j.data ?? []) {
  console.log('bundleId:', b.attributes?.identifier, '| name:', b.attributes?.name, '| seedId(TeamID):', b.attributes?.seedId);
}
// アプリ一覧（疎通確認）
const ra = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=5', { headers });
const ja = await ra.json();
if (ra.ok) {
  console.log('--- apps ---');
  for (const a of ja.data ?? []) console.log('app:', a.id, a.attributes?.bundleId, a.attributes?.name);
} else {
  console.error('apps API error', ra.status);
}

// APIキーで Certificates/Profiles の読み取り権限を確認する。
import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const KEY_ID = 'PABJUM2FM4';
const ISSUER = 'b495bc82-4182-4292-8e58-938b378a2e4d';
const P8 = process.env.HOME + '/.appstoreconnect/private_keys/AuthKey_PABJUM2FM4.p8';

const key = await importPKCS8(readFileSync(P8, 'utf8'), 'ES256');
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  .setIssuer(ISSUER).setIssuedAt().setExpirationTime('18m').setAudience('appstoreconnect-v1').sign(key);
const H = { Authorization: `Bearer ${jwt}` };

async function get(path) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, { headers: H });
  const t = await r.text();
  return { status: r.status, body: t.slice(0, 600) };
}

const certs = await get('/v1/certificates?limit=20');
console.log('GET /v1/certificates ->', certs.status);
try {
  const j = JSON.parse(certs.body);
  for (const c of j.data ?? []) console.log('  cert:', c.attributes?.certificateType, '|', c.attributes?.displayName, '| exp:', c.attributes?.expirationDate);
} catch { console.log('  body:', certs.body); }

const profs = await get('/v1/profiles?limit=20');
console.log('GET /v1/profiles ->', profs.status);
try {
  const j = JSON.parse(profs.body);
  for (const p of j.data ?? []) console.log('  profile:', p.attributes?.profileType, '|', p.attributes?.name, '|', p.attributes?.profileState);
} catch { console.log('  body:', profs.body); }

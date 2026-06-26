// App Store Connect API 共通ヘルパー
import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

export const KEY_ID = 'PABJUM2FM4';
export const ISSUER = 'b495bc82-4182-4292-8e58-938b378a2e4d';
export const APP_ID = '6783358148';
export const BUNDLE = 'com.tetsuyayasuda.truckloader';
const P8 = process.env.HOME + '/.appstoreconnect/private_keys/AuthKey_PABJUM2FM4.p8';

const key = await importPKCS8(readFileSync(P8, 'utf8'), 'ES256');

export async function token() {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
    .setIssuer(ISSUER).setIssuedAt().setExpirationTime('19m').setAudience('appstoreconnect-v1').sign(key);
}

export async function api(method, path, body, extraHeaders = {}) {
  const t = await token();
  const isAbs = path.startsWith('http');
  const url = isAbs ? path : 'https://api.appstoreconnect.apple.com' + path;
  const headers = { Authorization: `Bearer ${t}`, ...extraHeaders };
  if (body !== undefined && !(body instanceof Buffer)) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : (body instanceof Buffer ? body : JSON.stringify(body)),
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  if (!r.ok) {
    const errs = json?.errors?.map(e => `${e.status} ${e.code} ${e.title} :: ${e.detail}`).join('\n   ') || text.slice(0, 800);
    throw new Error(`${method} ${path} -> ${r.status}\n   ${errs}`);
  }
  return json;
}

export const G = (p) => api('GET', p);

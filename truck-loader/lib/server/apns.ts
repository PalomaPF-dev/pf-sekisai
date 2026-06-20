/**
 * APNs（Apple Push Notification service）送信ユーティリティ（フェーズ6・サーバー専用）。
 *
 * トークンベース認証（.p8鍵）で ES256 JWT を署名し、HTTP/2 で api.push.apple.com に送信する。
 * 追加依存なし（jose + Node標準 http2）。
 *
 * 必要な環境変数（Apple Developer で発行）:
 *   APNS_KEY        … .p8 鍵の中身（PKCS8 PEM。-----BEGIN PRIVATE KEY----- を含む全文）
 *   APNS_KEY_ID     … Key ID（10文字）
 *   APNS_TEAM_ID    … Team ID（10文字）
 *   APNS_BUNDLE_ID  … アプリのBundle ID（例: jp.co.example.truckloader）= apns-topic
 *   APNS_PRODUCTION … '1' で本番ゲートウェイ、未設定/0 で sandbox（開発ビルド用）
 *
 * ※ 本番環境(Vercel)にこれらを設定するまで送信はできない（呼び出すと例外）。
 */
import http2 from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';

export interface ApnsPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ApnsSendResult {
  token: string;
  ok: boolean;
  status?: number;
  reason?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`APNs設定が不足しています: 環境変数 ${name} を設定してください`);
  return v;
}

// JWT は最大1時間有効。使い回す（Apple推奨：頻繁な再発行は避ける）。
let cachedJwt: { token: string; iat: number } | null = null;

async function getApnsJwt(): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedJwt && nowSec - cachedJwt.iat < 50 * 60) return cachedJwt.token;

  const keyPem = requireEnv('APNS_KEY').replace(/\\n/g, '\n');
  const keyId = requireEnv('APNS_KEY_ID');
  const teamId = requireEnv('APNS_TEAM_ID');

  const privateKey = await importPKCS8(keyPem, 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(nowSec)
    .sign(privateKey);

  cachedJwt = { token, iat: nowSec };
  return token;
}

function apnsHost(): string {
  return process.env.APNS_PRODUCTION === '1' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
}

/** 1トークンへ送信 */
async function sendOne(token: string, jwt: string, bundleId: string, payload: ApnsPayload): Promise<ApnsSendResult> {
  return new Promise((resolve) => {
    const client = http2.connect(apnsHost());
    client.on('error', (err) => resolve({ token, ok: false, reason: String(err) }));

    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
      ...(payload.data ?? {}),
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });

    let status = 0;
    let data = '';
    req.on('response', (headers) => { status = Number(headers[':status']) || 0; });
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      client.close();
      if (status === 200) resolve({ token, ok: true, status });
      else {
        let reason = data;
        try { reason = JSON.parse(data).reason ?? data; } catch { /* keep raw */ }
        resolve({ token, ok: false, status, reason });
      }
    });
    req.on('error', (err) => { client.close(); resolve({ token, ok: false, reason: String(err) }); });
    req.write(body);
    req.end();
  });
}

/** 複数トークンへプッシュ送信 */
export async function sendApns(tokens: string[], payload: ApnsPayload): Promise<ApnsSendResult[]> {
  if (!tokens.length) return [];
  const jwt = await getApnsJwt();
  const bundleId = requireEnv('APNS_BUNDLE_ID');
  return Promise.all(tokens.map((t) => sendOne(t, jwt, bundleId, payload)));
}

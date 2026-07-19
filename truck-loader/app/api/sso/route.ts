/**
 * GET /api/sso?token=... — ポータルからのシングルサインオン受け口。
 * ポータル（同一組織・共有キー PF_PROVISION_KEY）が発行した署名付きトークンを検証し、
 * 該当ユーザーの通常の NextAuth セッションを発行して "/" へリダイレクトする。
 * トークン: base64url(JSON{loginId, app:'sekisai', exp(epoch ms・60秒有効)}) + "." + hex HMAC-SHA256。
 * 検証失敗時は詳細を出さず /login?error=sso へ。pending（アプリ側パスワード未設定）でも
 * ポータル認証済みのためログイン可（レコードは変更しない）。
 */
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { encode } from 'next-auth/jwt';
import { neon } from '@neondatabase/serverless';
import { ensureAuthSchema } from '@/lib/authDb';

export const runtime = 'nodejs';

const APP_KEY = 'sekisai';
const MAX_AGE = 30 * 24 * 60 * 60; // NextAuth 既定の30日に合わせる

function fail(req: Request) {
  return NextResponse.redirect(new URL('/login?error=sso', req.url), 302);
}

export async function GET(req: Request) {
  const secret = (process.env.PF_PROVISION_KEY || '').trim();
  const authSecret = (process.env.NEXTAUTH_SECRET || '').trim();
  if (!secret || !authSecret) {
    return NextResponse.json({ error: 'SSOが未設定です' }, { status: 503 });
  }

  const token = new URL(req.url).searchParams.get('token') || '';
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return fail(req);
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(req);

  let data: { loginId?: unknown; app?: unknown; exp?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return fail(req);
  }
  const loginId = typeof data.loginId === 'string' ? data.loginId.trim() : '';
  if (!loginId || data.app !== APP_KEY) return fail(req);
  if (typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp < Date.now()) return fail(req);

  const sql = neon(process.env.DATABASE_URL!);
  let rows;
  try {
    rows = await sql`
      SELECT u.id, u.email, u.name, c.id AS company_id, c.name AS company_name
      FROM users u JOIN companies c ON c.id = u.company_id
      WHERE u.login_id = ${loginId} LIMIT 1`;
  } catch {
    // login_id 列が未追加の既存DBでは冪等migration後に一度だけ再試行
    try {
      await ensureAuthSchema();
      rows = await sql`
        SELECT u.id, u.email, u.name, c.id AS company_id, c.name AS company_name
        FROM users u JOIN companies c ON c.id = u.company_id
        WHERE u.login_id = ${loginId} LIMIT 1`;
    } catch {
      return fail(req);
    }
  }
  const user = rows[0];
  if (!user) return fail(req);

  // authorize() 成功時と同じ形のJWTを発行（jwt callback は id/companyId/companyName を持ち回す）
  const jwt = await encode({
    token: {
      sub: user.id as string,
      id: user.id as string,
      email: ((user.email as string | null) ?? '') as string,
      name: user.name as string,
      companyId: user.company_id as string,
      companyName: user.company_name as string,
    },
    secret: authSecret,
    maxAge: MAX_AGE,
  });

  const useSecure = (process.env.NEXTAUTH_URL || 'https://sekisai.paloma-pf.com').startsWith('https');
  const cookieName = useSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
  const res = NextResponse.redirect(new URL('/', req.url), 302);
  res.cookies.set(cookieName, jwt, {
    httpOnly: true,
    secure: useSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  // デモ閲覧の名残があればクラウドモードに正規化（ログイン画面と同じ後始末）
  res.cookies.set('truckloader.demo', '', { path: '/', maxAge: 0 });
  return res;
}

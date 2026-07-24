/**
 * POST /api/auth/token — メール/パスワードでログインし、アクセストークン(JWT)を発行。
 * body: { email, password } → { token, user: { email, name, companyName } }
 *
 * ネイティブアプリ（Cookieが使えない）向けのログイン。Web版は従来のNextAuthでよい。
 * 認証ロジックは authOptions.authorize と同等（同じ users/companies 照合）。
 */
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { signAuthToken } from '@/lib/server/auth';
import { withCors, preflight } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  return withCors(req, await handlePOST(req));
}

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) return new NextResponse('Bad Request', { status: 400 });

  const url = process.env.DATABASE_URL;
  if (!url) return new NextResponse('Server misconfigured', { status: 500 });
  const sql = neon(url);

  const rows = await sql`
    SELECT u.id, u.email, u.name, u.password_hash, u.role,
           c.id AS company_id, c.name AS company_name
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.email = ${email}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) return new NextResponse('Unauthorized', { status: 401 });

  const token = await signAuthToken({
    userId: user.id as string,
    companyId: user.company_id as string,
    companyName: user.company_name as string,
    role: user.role === 'admin' || user.role === 'worker' ? (user.role as 'admin' | 'worker') : 'member',
  });

  return NextResponse.json({
    token,
    user: { email: user.email, name: user.name, companyName: user.company_name },
  });
}

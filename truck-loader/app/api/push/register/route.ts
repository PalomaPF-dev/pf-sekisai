/**
 * POST /api/push/register — 端末のプッシュトークンを登録（フェーズ6）。
 * body: { token: string, platform?: 'ios' | 'web' }
 *
 * テナント(company_id)単位で device_tokens に upsert。Cookieセッション認証。
 * TODO(フェーズ6/認証): ネイティブからは Bearer トークン認証に対応する。
 */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import { sql } from '@/lib/neon';
import { withCors, preflight } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  return withCors(req, await handlePOST(req));
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS device_tokens (
      token text PRIMARY KEY,
      company_id uuid NOT NULL,
      platform text NOT NULL DEFAULT 'ios',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function handlePOST(req: Request) {
  const auth = await getAuthContext(req);
  const companyId = auth?.companyId;
  if (!companyId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.token !== 'string' || !body.token) {
    return new NextResponse('Bad Request', { status: 400 });
  }
  const platform = body.platform === 'web' ? 'web' : 'ios';

  await ensureTable();
  await sql`
    INSERT INTO device_tokens (token, company_id, platform)
    VALUES (${body.token}, ${companyId}, ${platform})
    ON CONFLICT (token)
    DO UPDATE SET company_id = EXCLUDED.company_id, platform = EXCLUDED.platform, updated_at = now()
  `;

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/subscription/status
 * 現在の会社のエンタイトルメント（トライアル/契約）を返す。Web(Cookie)・iOS(Bearer)両対応。
 * 認証は getAuthContext。middleware の matcher から除外（自前認証）。
 */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import { getCompanyEntitlement } from '@/lib/server/subscription';
import { withCors, preflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  return withCors(req, await handleGET(req));
}

async function handleGET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await getCompanyEntitlement(ctx.companyId));
  } catch (e) {
    return NextResponse.json({ error: 'failed', message: (e as Error).message }, { status: 500 });
  }
}

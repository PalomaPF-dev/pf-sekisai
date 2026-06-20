/**
 * GET /api/subscription/status
 * 現在の会社のサブスク状態を返す。Web(Cookie)・iOS(Bearer) 両対応。
 * 認証は getAuthContext。middleware の matcher から除外済み（自前認証）。
 */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import { getCompanySubscription } from '@/lib/server/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const sub = await getCompanySubscription(ctx.companyId);
    return NextResponse.json(sub);
  } catch (e) {
    return NextResponse.json({ error: 'failed', message: (e as Error).message }, { status: 500 });
  }
}

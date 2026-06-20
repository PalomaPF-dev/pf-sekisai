/**
 * POST /api/webhooks/revenuecat
 * RevenueCat からのサブスクイベントを受け、companies のエンタイトルメントを更新する。
 * 認証: RevenueCat ダッシュボードで設定する Authorization ヘッダ（共有シークレット）を検証。
 *   env: RC_WEBHOOK_AUTH
 * middleware の matcher から除外済み（Cookie認証は使わない）。
 */
import { NextResponse } from 'next/server';
import { applyRevenueCatEvent } from '@/lib/server/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.RC_WEBHOOK_AUTH;
  if (!expected) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const event = body?.event;
  if (!event) return NextResponse.json({ error: 'no event' }, { status: 400 });

  try {
    const ok = await applyRevenueCatEvent(event as Parameters<typeof applyRevenueCatEvent>[0]);
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ error: 'failed', message: (e as Error).message }, { status: 500 });
  }
}

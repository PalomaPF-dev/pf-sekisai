/**
 * POST /api/sync/push — ローカルのスナップショットを正規化テーブルへ保存（フェーズ4）。
 * body: { data: object, updatedAt: number }（DatasetSnapshot）
 *
 * Web版と同じ正規化テーブル（products 等）へ反映するため、Web版にも変更が見える。
 * 認証: Bearerトークン（ネイティブ）/ Cookieセッション（Web）両対応。
 */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import { saveSnapshotData } from '@/lib/server/syncRepo';
import { withCors, preflight } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  return withCors(req, await handlePOST(req));
}

async function handlePOST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth?.companyId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.updatedAt !== 'number' || typeof body.data !== 'object' || body.data === null) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  await saveSnapshotData(auth.companyId, body.data, body.updatedAt);
  return NextResponse.json({ ok: true });
}

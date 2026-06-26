/**
 * GET /api/sync/pull — サーバーの最新スナップショットを返す（フェーズ4）。
 *
 * 正規化テーブル（products 等＝Web版と同一）からデータセットを組み立てて返す。
 * 認証: Bearerトークン（ネイティブ）/ Cookieセッション（Web）両対応。
 */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import { loadSnapshotData, getSyncUpdatedAt } from '@/lib/server/syncRepo';
import { withCors, preflight } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  return withCors(req, await handleGET(req));
}

async function handleGET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth?.companyId) return new NextResponse('Unauthorized', { status: 401 });

  const [data, updatedAt] = await Promise.all([
    loadSnapshotData(auth.companyId),
    getSyncUpdatedAt(auth.companyId),
  ]);

  return NextResponse.json({ data, updatedAt });
}

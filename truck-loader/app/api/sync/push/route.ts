/**
 * POST /api/sync/push — ローカルのスナップショットを正規化テーブルへ保存（フェーズ4）。
 * body: { data: object, updatedAt: number }（DatasetSnapshot）
 *
 * Web版と同じ正規化テーブル（products 等）へ反映するため、Web版にも変更が見える。
 * 認証: Bearerトークン（ネイティブ）/ Cookieセッション（Web）両対応。
 *
 * 権限: マスタ（工場・製品・倉庫・トラック種別・パレット種別）の変更は role==='admin' のみ。
 *       非管理者のpushは受信マスタを破棄し、サーバ現行のマスタで上書きしてから保存する
 *       （＝日常業務データ＝在庫/生産/計画等の書き込みは全員に許可しつつ、マスタは保護）。
 */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import { saveSnapshotData, loadMasterData, MASTER_KEYS } from '@/lib/server/syncRepo';
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

  const data = body.data as Record<string, unknown>;

  // 非管理者はマスタ（工場/製品/倉庫/トラック/パレット種別）を変更できない。
  // 受信スナップショットのマスタ部分をサーバ現行値で上書きして保護する。
  // 業務データ（在庫/生産/計画/スケジュール等）はそのまま保存を許可する。
  if (auth.role !== 'admin') {
    const currentMaster = await loadMasterData(auth.companyId);
    for (const key of MASTER_KEYS) data[key] = currentMaster[key];
  }

  await saveSnapshotData(auth.companyId, data, body.updatedAt);
  return NextResponse.json({ ok: true });
}

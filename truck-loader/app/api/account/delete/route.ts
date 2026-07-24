/**
 * POST /api/account/delete — アカウント（テナント）とその全データを削除する。
 *
 * App Store ガイドライン 5.1.1(v)（アカウント作成があるアプリは削除も提供）対応。
 * 認証: Bearerトークン（ネイティブ）/ Cookieセッション（Web）両対応。
 *
 * companies を削除すると、ON DELETE CASCADE により users および各データテーブル
 * （products / factories / ... ）も連動削除される。FK の無い同期/通知テーブルは明示削除。
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

async function handlePOST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth?.companyId) return new NextResponse('Unauthorized', { status: 401 });

  // 作業者（role='worker'）は閲覧専用。アカウント削除（全データ削除）は拒否する。
  if (auth.role === 'worker') {
    return NextResponse.json({ error: '作業者アカウントは閲覧のみ可能です。' }, { status: 403 });
  }
  const cid = auth.companyId;

  // FKの無い補助テーブル（存在しなければ作成→削除でエラー回避）
  await sql`CREATE TABLE IF NOT EXISTS sync_snapshots (company_id uuid PRIMARY KEY, data jsonb NOT NULL, updated_at bigint NOT NULL)`;
  await sql`DELETE FROM sync_snapshots WHERE company_id = ${cid}`;
  await sql`CREATE TABLE IF NOT EXISTS device_tokens (token text PRIMARY KEY, company_id uuid NOT NULL, platform text NOT NULL DEFAULT 'ios', updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`DELETE FROM device_tokens WHERE company_id = ${cid}`;

  // companies 削除 → users / 各データ（ON DELETE CASCADE）も連動削除
  await sql`DELETE FROM companies WHERE id = ${cid}`;

  return NextResponse.json({ ok: true });
}

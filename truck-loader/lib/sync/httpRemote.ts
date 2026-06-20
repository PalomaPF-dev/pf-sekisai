/**
 * HTTPリモート（フェーズ4）。Vercel上の /api/sync/* と同期する本番用実装。
 *
 * - Web: 同一オリジン + Cookie セッション（NextAuth）で認証される
 * - ネイティブ: 絶対URL（NEXT_PUBLIC_SYNC_API）+ Bearer トークンが必要
 *   （実トークン認証はフェーズ2の認証オフライン化の続きとして要実装＝下記TODO）
 */
import type { RemoteSync, DatasetSnapshot } from './types';
import { getToken } from '../auth/token';
import { syncApiBase, authHeader } from '../auth/cloudAuth';

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  // ネイティブ=Bearerトークン、Web=Cookieセッション（credentials:'include'）
  const token = await getToken();
  return { ...extra, ...authHeader(token) };
}

export const httpRemote: RemoteSync = {
  async pull(): Promise<DatasetSnapshot | null> {
    const res = await fetch(`${syncApiBase()}/api/sync/pull`, {
      method: 'GET',
      headers: await headers(),
      credentials: 'include',
    });
    if (res.status === 204) return null; // サーバーにデータ無し
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    return (await res.json()) as DatasetSnapshot;
  },

  async push(snapshot: DatasetSnapshot): Promise<void> {
    const res = await fetch(`${syncApiBase()}/api/sync/push`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(snapshot),
    });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
  },
};

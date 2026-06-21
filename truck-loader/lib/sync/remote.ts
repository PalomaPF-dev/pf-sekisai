/**
 * リモート実装のセレクタ（フェーズ4）。
 *
 * 優先順位:
 *   1) localStorage 'truckloader.sync' = 'mock' → モックリモート（検証用）
 *   2) localStorage 'truckloader.sync' = 'http' または NEXT_PUBLIC_SYNC_API 設定 → HTTPリモート
 *   3) いずれも無し → null（同期無効＝ローカル専用）
 */
import type { RemoteSync } from './types';
import { mockRemote } from './mockRemote';
import { httpRemote } from './httpRemote';

export function getRemoteSync(): RemoteSync | null {
  if (typeof window === 'undefined') return null;

  let mode: string | null = null;
  try {
    mode = window.localStorage.getItem('truckloader.sync');
  } catch {
    /* ignore */
  }

  if (mode === 'mock') return mockRemote;
  if (mode === 'http' || process.env.NEXT_PUBLIC_SYNC_API) return httpRemote;
  return null;
}

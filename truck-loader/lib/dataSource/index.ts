/**
 * DataSource セレクタ — 実行環境に応じて実装を選ぶ。
 *
 *   - SSR（サーバー）            → 必ず serverDataSource（IndexedDB不可のため）
 *   - ブラウザ + ローカル指定     → localDataSource（オフライン動作）
 *   - それ以外（既定）           → serverDataSource（現状のWeb挙動を維持）
 *
 * 切り替え優先順位:
 *   1) localStorage 'truckloader.dataSource' = 'local' | 'server'（実機/手動検証用）
 *   2) 環境変数 NEXT_PUBLIC_DATA_SOURCE = 'local'
 *   3) 既定 = 'server'
 *
 * 将来 Capacitor 上では「ネイティブ実行なら 'local'」を既定にする
 * （例: Capacitor.isNativePlatform()）。現状は明示指定でのみ local を使う。
 */
import type { DataSource } from './types';
import { serverDataSource } from './serverDataSource';
import { localDataSource } from './localDataSource';

export type { DataSource } from './types';

export type DataSourceMode = 'server' | 'local';

function resolveMode(): DataSourceMode {
  if (typeof window === 'undefined') return 'server';
  try {
    const ls = window.localStorage.getItem('truckloader.dataSource');
    if (ls === 'local' || ls === 'server') return ls;
  } catch {
    /* localStorage 不可環境 */
  }
  // Capacitor（iOS）静的ビルドは既定でローカル（オフライン動作）
  if (process.env.NEXT_PUBLIC_CAPACITOR === '1') return 'local';
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === 'local') return 'local';
  // Web 既定は server（ログイン必須）。デモは /login のボタンが localStorage='local' を
  // 明示セット＋デモCookie付与で入る。ログイン成功時も 'server' を明示セット。
  return 'server';
}

let cached: DataSource | null = null;

/** 現在の実行環境に対応する DataSource を返す（プロセス内でキャッシュ） */
export function getDataSource(): DataSource {
  if (cached) return cached;
  cached = resolveMode() === 'local' ? localDataSource : serverDataSource;
  return cached;
}

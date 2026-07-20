'use client';

/**
 * ログインユーザーの役割（role）をクライアントから読むためのフック。
 *
 * マスタ（工場・製品・倉庫・トラック種別・パレット種別）と計算設定の編集は
 * role === 'admin' のみに制限する。日常業務（積載計画の閲覧・作成、在庫/スケジュール
 * 入力）は全ログインユーザーに開放する。
 *
 * セッションに role が無い（＝旧セッションや未ログイン）場合は 'member' 相当（安全側）。
 * ネイティブ（Capacitor）は authClient のスタブが role='admin' のローカルユーザーを返す。
 */
import { useSession } from './authClient';
import type { AppRole } from '@/types/next-auth';

export function useRole(): AppRole | undefined {
  const { data } = useSession();
  return data?.user?.role;
}

/** マスタ設定を編集できる管理者かどうか。 */
export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}

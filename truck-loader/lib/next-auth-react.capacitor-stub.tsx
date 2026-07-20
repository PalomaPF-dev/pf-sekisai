'use client';

/**
 * next-auth/react の Capacitor（オフライン）向けスタブ。
 *
 * 静的書き出しアプリには `/api/auth/*` が存在しないため、本物の SessionProvider は
 * セッション取得fetchに失敗して CLIENT_FETCH_ERROR を出す。ネイティブはオフライン・
 * 単一端末前提なので「常にローカルユーザーでログイン済み」として扱う。
 * next.config.mjs（CAPACITOR_BUILD時）の webpack エイリアスで 'next-auth/react' を
 * 本モジュールに差し替える。
 *
 * フェーズ4でオンライン同期＋実認証を入れる際は、ここをトークン保持方式
 * （Capacitor Preferences/Keychain）に置き換える。
 */
import React from 'react';

const LOCAL_USER = {
  name: 'ローカルユーザー',
  email: 'local@device',
  companyId: 'local',
  companyName: 'オフライン',
  // ネイティブは単一端末・オフライン前提のため、ローカルユーザーは管理者扱い
  // （マスタ設定の編集を許可）。オンライン同期時はサーバがトークンの role で判定する。
  role: 'admin' as const,
};

const LOCAL_SESSION = {
  user: LOCAL_USER,
  expires: '2999-12-31T00:00:00.000Z',
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // セッション取得fetchを一切行わず、子をそのまま描画する
  return <>{children}</>;
}

export function useSession() {
  return {
    data: LOCAL_SESSION,
    status: 'authenticated' as const,
    update: async () => LOCAL_SESSION,
  };
}

export async function signIn(_provider?: string, _options?: Record<string, unknown>) {
  // オフラインではログイン不要。ダッシュボードへ。
  if (typeof window !== 'undefined') window.location.href = '/';
  return { ok: true, error: undefined, status: 200, url: '/' };
}

export async function signOut(_options?: Record<string, unknown>) {
  if (typeof window !== 'undefined') window.location.href = '/';
  return { url: '/' };
}

export async function getSession() {
  return LOCAL_SESSION;
}

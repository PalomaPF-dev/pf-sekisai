/**
 * クラウド同期のログイン（フェーズ4/6 残作業：ネイティブのトークン認証）。
 *
 * メール/パスワードで /api/auth/token を叩き、返ったJWTを端末保存する。
 * ログイン成功で同期を 'http' モードに切替（getRemoteSync が httpRemote を使う）。
 *
 * API ベースURL: ネイティブは別オリジン(Vercel)を指すため NEXT_PUBLIC_SYNC_API が必要。
 * Web/同一オリジンは空文字でよい。
 */
import { getToken, setToken, clearToken } from './token';

export function syncApiBase(): string {
  return process.env.NEXT_PUBLIC_SYNC_API ?? '';
}

export function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CloudLoginResult {
  ok: boolean;
  companyName?: string;
  message?: string;
}

export async function cloudLogin(email: string, password: string): Promise<CloudLoginResult> {
  try {
    const res = await fetch(`${syncApiBase()}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 401) return { ok: false, message: 'メールアドレスまたはパスワードが違います' };
    if (!res.ok) return { ok: false, message: `ログインに失敗しました (${res.status})` };

    const data = await res.json();
    if (!data?.token) return { ok: false, message: 'トークンを取得できませんでした' };
    await setToken(data.token);
    // 同期を有効化（httpリモート）
    try { window.localStorage.setItem('truckloader.sync', 'http'); } catch { /* ignore */ }
    return { ok: true, companyName: data.user?.companyName };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function cloudLogout(): Promise<void> {
  await clearToken();
  try { window.localStorage.removeItem('truckloader.sync'); } catch { /* ignore */ }
}

/** アカウント（テナント）とサーバー上の全データを削除し、ログアウトする */
export async function deleteAccount(): Promise<{ ok: boolean; message?: string }> {
  try {
    const token = await getToken();
    const res = await fetch(`${syncApiBase()}/api/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      credentials: 'include',
    });
    if (!res.ok) return { ok: false, message: `削除に失敗しました (${res.status})` };
    await cloudLogout();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function isCloudLoggedIn(): Promise<boolean> {
  return !!(await getToken());
}

/**
 * アクセストークンの端末保存（フェーズ4/6 残作業）。
 * - ネイティブ: @capacitor/preferences（UserDefaults相当）
 * - Web: localStorage
 *
 * ※ より堅牢にするなら Keychain プラグインへ差し替え可（将来のセキュリティ強化）。
 */
import { Capacitor } from '@capacitor/core';

const KEY = 'truckloader.authToken';

export async function setToken(token: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: KEY, value: token });
  } else if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: KEY });
    return value ?? null;
  }
  if (typeof window !== 'undefined') return window.localStorage.getItem(KEY);
  return null;
}

export async function clearToken(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: KEY });
  } else if (typeof window !== 'undefined') {
    window.localStorage.removeItem(KEY);
  }
}

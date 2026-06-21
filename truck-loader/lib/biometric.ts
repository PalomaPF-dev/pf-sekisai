/**
 * Face ID / Touch ID（生体認証）によるアプリロック。
 * ネイティブ(iOS)のみ有効。Web では無効（常に解除扱い）。
 * 設定は localStorage 'truckloader.biometricLock'（'1'=有効）。既定オフ。
 */
import { Capacitor } from '@capacitor/core';

const KEY = 'truckloader.biometricLock';

export function isBiometricPlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isBiometricLockEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setBiometricLockEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** 端末で生体認証（またはパスコード）が利用可能か。表示名つき。 */
export async function checkBiometryAvailable(): Promise<{ available: boolean; label: string }> {
  if (!isBiometricPlatform()) return { available: false, label: '' };
  try {
    const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth');
    const info = await BiometricAuth.checkBiometry();
    const label =
      info.biometryType === BiometryType.faceId ? 'Face ID'
      : info.biometryType === BiometryType.touchId ? 'Touch ID'
      : 'デバイス認証';
    // 生体が使える、または端末パスコードへフォールバック可能なら有効とみなす
    return { available: Boolean(info.isAvailable), label };
  } catch {
    return { available: false, label: '' };
  }
}

/** 生体認証を実行。成功で true。失敗/キャンセルで false。 */
export async function authenticateBiometric(reason: string): Promise<boolean> {
  if (!isBiometricPlatform()) return true;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'キャンセル',
      iosFallbackTitle: 'パスコードを使用',
      allowDeviceCredential: true, // 生体が使えない端末はパスコードで解除
    });
    return true;
  } catch {
    return false;
  }
}

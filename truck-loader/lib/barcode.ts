/**
 * バーコード/QR スキャンのラッパー（フェーズ5）。
 *
 * - ネイティブ(iOS/Capacitor): @capacitor-mlkit/barcode-scanning のフルスクリーン
 *   スキャナUIを使用。カメラ権限の確認・要求も内包。
 * - Web/ブラウザ: カメラスキャナは使えないため window.prompt による手入力に
 *   フォールバック（動作確認・手入力運用の両対応）。
 *
 * 呼び出し側は scanBarcode() だけ使えばよい。結果は読み取った文字列、
 * キャンセル時は null。
 */
import { Capacitor } from '@capacitor/core';

export type ScanResult =
  | { ok: true; value: string; source: 'camera' | 'manual' }
  | { ok: false; reason: 'cancelled' | 'denied' | 'unsupported' | 'error'; message?: string };

/** カメラスキャンが使える環境か（ネイティブのみ） */
export function isCameraScanAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * バーコード/QRを1件スキャンして文字列を返す。
 * ネイティブ=カメラ、Web=手入力フォールバック。
 */
export async function scanBarcode(): Promise<ScanResult> {
  if (!Capacitor.isNativePlatform()) {
    // Web: 手入力フォールバック
    const value = typeof window !== 'undefined'
      ? window.prompt('バーコード/製品コードを入力してください（Web版は手入力）')
      : null;
    if (value == null || value.trim() === '') return { ok: false, reason: 'cancelled' };
    return { ok: true, value: value.trim(), source: 'manual' };
  }

  try {
    // ネイティブのみ動的import（Web静的ビルドにネイティブ依存を持ち込まない）
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) return { ok: false, reason: 'unsupported', message: 'この端末はスキャンに非対応です' };

    // 権限確認・要求
    let perm = await BarcodeScanner.checkPermissions();
    if (perm.camera !== 'granted') {
      perm = await BarcodeScanner.requestPermissions();
    }
    if (perm.camera !== 'granted') {
      return { ok: false, reason: 'denied', message: 'カメラの使用が許可されていません' };
    }

    const { barcodes } = await BarcodeScanner.scan();
    const value = barcodes?.[0]?.rawValue?.trim();
    if (!value) return { ok: false, reason: 'cancelled' };
    return { ok: true, value, source: 'camera' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

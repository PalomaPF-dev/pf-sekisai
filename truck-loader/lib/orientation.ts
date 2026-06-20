/**
 * 画面向き（ネイティブのみ）。
 *
 * 方針: 全画面で横向き（landscape）に固定。現場で表・荷台図を見る用途に最適。
 * iOSは Info.plist の UISupportedInterfaceOrientations を Landscape のみにして固定し、
 * 念のため起動時に ScreenOrientation でも landscape にロックする。
 * Web/ブラウザでは何もしない。
 */
import { Capacitor } from '@capacitor/core';

/** 横向きに固定する */
export async function lockLandscape(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch {
    /* プラグイン未導入/未対応端末では何もしない */
  }
}

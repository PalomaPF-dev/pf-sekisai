/**
 * ネットワーク状態の検知（フェーズ4）。
 * - Web: navigator.onLine + online/offline イベント
 * - ネイティブ: @capacitor/network（導入済みなら）を動的import
 *
 * @capacitor/network 未導入でも navigator ベースで動作するため必須依存ではない。
 */
import { Capacitor } from '@capacitor/core';

export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/** オンライン状態の変化を購読。戻り値で購読解除。 */
export function subscribeOnline(cb: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // Web イベント（ネイティブのWebViewでも基本動作する）
  const onOnline = () => cb(true);
  const onOffline = () => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // ネイティブ: @capacitor/network があればより正確に購読
  let removeNative: (() => void) | null = null;
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/network')
      .then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => cb(status.connected)).then((handle) => {
          removeNative = () => handle.remove();
        });
      })
      .catch(() => {
        /* 未導入なら Web イベントのみで動作 */
      });
  }

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    removeNative?.();
  };
}

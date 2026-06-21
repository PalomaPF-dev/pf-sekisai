'use client';

/**
 * 設定画面の「Face ID ロック」トグル。ネイティブのみ表示。
 * 有効化時はその場で一度認証して、解除できることを確認する。
 */
import { useEffect, useState } from 'react';
import {
  isBiometricPlatform, isBiometricLockEnabled, setBiometricLockEnabled,
  checkBiometryAvailable, authenticateBiometric,
} from '@/lib/biometric';
import { toast } from '@/components/Toast';

export function BiometricLockSetting() {
  const [enabled, setEnabled] = useState(false);
  const [avail, setAvail] = useState<{ available: boolean; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(isBiometricLockEnabled());
    void checkBiometryAvailable().then(setAvail);
  }, []);

  // ネイティブ以外、または生体認証が使えない端末では出さない
  if (!isBiometricPlatform()) return null;

  const label = avail?.label || 'Face ID';

  const toggle = async () => {
    if (busy) return;
    if (!enabled) {
      // 有効化：使えるか確認＋一度認証
      if (avail && !avail.available) {
        toast('この端末では生体認証が設定されていません（iOSの設定でFace ID/パスコードを有効にしてください）', 'error');
        return;
      }
      setBusy(true);
      const ok = await authenticateBiometric('ロックを有効にするため認証します');
      setBusy(false);
      if (!ok) { toast('認証できなかったため有効化を中止しました', 'info'); return; }
      setBiometricLockEnabled(true);
      setEnabled(true);
      toast(`✓ ${label} ロックを有効にしました`, 'success');
    } else {
      setBiometricLockEnabled(false);
      setEnabled(false);
      toast(`${label} ロックを無効にしました`, 'info');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">🔒 {label} ロック</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            アプリ起動時と復帰時に {label}（またはパスコード）でロックを解除します。
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={enabled}
          className={
            'shrink-0 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ' +
            (enabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50')
          }
        >
          {busy ? '…' : enabled ? '有効' : '無効'}
        </button>
      </div>
    </div>
  );
}

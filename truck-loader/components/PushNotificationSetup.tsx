'use client';

/**
 * プッシュ通知の有効化UI（フェーズ6）。設定ページに置く。
 * ネイティブ=APNs登録、Web=Notification APIデモ。
 */
import { useEffect, useState } from 'react';
import { enablePush, getPushStatus, isNativePush, type PushStatus } from '@/lib/push';
import { toast } from '@/components/Toast';

export function PushNotificationSetup() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    setStatus(res.status);
    if (res.ok) {
      toast(res.source === 'apns' ? '✓ プッシュ通知を有効化しました' : '✓ 通知を有効化しました（Web）', 'success');
    } else if (res.status === 'denied') {
      toast('通知が拒否されています。端末の設定から許可してください', 'error');
    } else if (res.status === 'unsupported') {
      toast('この環境は通知に非対応です', 'error');
    } else if (res.message) {
      toast(res.message, 'error');
    }
  };

  const label =
    status === 'granted' ? '✓ 有効'
    : status === 'denied' ? '拒否されています'
    : status === 'unsupported' ? '非対応'
    : '未設定';

  const labelColor =
    status === 'granted' ? '#16a34a'
    : status === 'denied' ? '#dc2626'
    : '#6b7280';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">🔔 プッシュ通知</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            出荷予定・積込完了・計画更新などをお知らせします
            {!isNativePush() && '（Web版はブラウザ通知のデモ）'}
          </p>
          <p className="text-xs mt-1" style={{ color: labelColor }}>状態: {label}</p>
        </div>
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy || status === 'granted' || status === 'unsupported'}
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '設定中…' : status === 'granted' ? '有効' : '通知を有効にする'}
        </button>
      </div>
    </div>
  );
}

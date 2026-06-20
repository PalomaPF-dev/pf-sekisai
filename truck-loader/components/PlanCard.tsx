'use client';

/**
 * 設定画面の「プラン」カード。現在のプラン表示＋アップグレード/購入復元。
 */
import { useState } from 'react';
import { useEntitlement } from '@/lib/entitlement';
import { isNative, restorePurchases } from '@/lib/revenuecat';
import { toast } from '@/components/Toast';

export function PlanCard() {
  const { isPro, loading, openUpgrade, refresh } = useEntitlement();
  const [busy, setBusy] = useState(false);

  const handleRestore = async () => {
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok && res.isPro) { toast('✓ 購入を復元しました', 'success'); void refresh(); }
    else toast('復元できる購入が見つかりませんでした', 'info');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">💳 プラン</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading ? '確認中…' : isPro ? '現在のプラン：Pro（全機能が利用可能）' : '現在のプラン：無料'}
          </p>
        </div>
        <span
          className={
            'shrink-0 rounded-full px-3 py-1 text-xs font-bold ' +
            (isPro ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')
          }
        >
          {isPro ? 'PRO' : 'FREE'}
        </span>
      </div>

      {!isPro && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => openUpgrade('')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            プロにアップグレード
          </button>
          {isNative() && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              購入を復元
            </button>
          )}
        </div>
      )}

      {isPro && isNative() && (
        <div className="mt-3">
          <a
            href="https://apps.apple.com/account/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            サブスクリプションを管理
          </a>
          <p className="mt-1 text-[11px] text-gray-400">解約・プラン変更は iOS の「設定 → Apple ID → サブスクリプション」からも行えます。</p>
        </div>
      )}

      {!isPro && (
        <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
          複数拠点・CSV・PDF・クラウド同期・バーコード照合などが利用できます。購読は iOS アプリ内から行えます。
        </p>
      )}

      <p className="mt-3 text-[11px] text-gray-400">
        <a href="/terms" className="underline hover:text-gray-600">利用規約(EULA)</a>
        {' / '}
        <a href="/privacy" className="underline hover:text-gray-600">プライバシーポリシー</a>
      </p>
    </div>
  );
}

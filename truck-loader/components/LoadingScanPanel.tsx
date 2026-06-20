'use client';

/**
 * 積込スキャンパネル（フェーズ5）。
 *
 * バーコード/QRをスキャンして製品マスタと突合し、積込確認を行う自己完結コンポーネント。
 * - ネイティブ: カメラでスキャン（@capacitor-mlkit/barcode-scanning）
 * - Web: 手入力フォールバック（動作確認・手入力運用）
 *
 * expectedCodes を渡すと「計画内/計画外」を区別して警告できる（誤積み防止）。
 */
import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { scanBarcode, isCameraScanAvailable } from '@/lib/barcode';
import { toast } from '@/components/Toast';

interface ScannedEntry {
  code: string;
  name: string | null;
  matched: boolean;
  inPlan: boolean;
}

export function LoadingScanPanel({ expectedCodes }: { expectedCodes?: Set<string> }) {
  const products = useAppStore((s) => s.products);
  const [entries, setEntries] = useState<ScannedEntry[]>([]);
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async () => {
    setScanning(true);
    const res = await scanBarcode();
    setScanning(false);

    if (!res.ok) {
      if (res.reason !== 'cancelled') toast(res.message ?? 'スキャンできませんでした', 'error');
      return;
    }

    const code = res.value;
    const product = products.find((p) => p.code === code || p.name === code);
    const matched = !!product;
    const inPlan = matched && (expectedCodes ? expectedCodes.has(product!.code) : true);

    setEntries((prev) => {
      const without = prev.filter((e) => e.code !== code);
      return [{ code, name: product?.name ?? null, matched, inPlan }, ...without];
    });

    if (!matched) {
      toast(`未登録のコード: ${code}`, 'error');
    } else if (!inPlan) {
      toast(`⚠️ ${product!.name} は今回の計画外です`, 'error');
    } else {
      toast(`✓ ${product!.name} を積込確認`, 'success');
    }
  }, [products, expectedCodes]);

  const clearAll = useCallback(() => setEntries([]), []);

  const okCount = entries.filter((e) => e.matched && e.inPlan).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">📷 積込スキャン</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            製品のバーコード/QRを読み取り、積込内容を確認します
            {!isCameraScanAvailable() && '（Web版は手入力）'}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-gray-800 underline shrink-0"
          >
            クリア
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleScan}
        disabled={scanning}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {scanning ? 'スキャン中…' : isCameraScanAvailable() ? 'カメラでスキャン' : 'コードを入力'}
      </button>

      {entries.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">
            確認済み: <span className="font-bold text-gray-800">{okCount}</span> 件
            {entries.length - okCount > 0 && (
              <span className="text-red-600 ml-2">要確認: {entries.length - okCount} 件</span>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <li
                key={e.code}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                style={{
                  background: !e.matched ? '#fef2f2' : !e.inPlan ? '#fffbeb' : '#f0fdf4',
                }}
              >
                <span className="text-base leading-none">
                  {!e.matched ? '⚠️' : !e.inPlan ? '❗' : '✓'}
                </span>
                <span className="font-medium text-gray-900">{e.name ?? '未登録'}</span>
                <span className="text-xs text-gray-500 ml-auto font-mono">{e.code}</span>
                {e.matched && !e.inPlan && (
                  <span className="text-xs text-amber-700">計画外</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * 作業者（role='worker'・閲覧専用）アカウントの常時バナー。
 * 全画面閲覧可・データの追加・編集・削除・取込・保存ができないことを伝える。
 * （実際の書込ブロックはサーバー側 lib/db.ts / 各APIルートで実施）
 */
import { useIsWorker } from '@/lib/useRole';

export function WorkerBanner() {
  const worker = useIsWorker();
  if (!worker) return null;
  return (
    <div className="bg-sky-100 border-b border-sky-300 text-sky-900 text-xs text-center py-1.5 px-4 font-medium">
      🔒 閲覧専用（作業者アカウント）です。データの追加・編集・保存はできません。
    </div>
  );
}

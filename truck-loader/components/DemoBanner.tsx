'use client';

/**
 * デモ（閲覧専用）モードの常時バナー。
 * デモ時のみ表示し、データの追加・編集・削除・取込・保存ができないことを伝える。
 * （実際の書込ブロックは lib/store.ts / lib/dataSource/localDataSource.ts で実施）
 */
import { useDemo, DEMO_READONLY_MESSAGE } from '@/lib/demo';

export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;
  return (
    <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs text-center py-1.5 px-4 font-medium">
      🔒 {DEMO_READONLY_MESSAGE}
    </div>
  );
}

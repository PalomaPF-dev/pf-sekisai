'use client';

/**
 * 同期ステータス表示＋自動同期の配線（フェーズ4）。
 * Navbar に1つ置く。リモートが設定されていれば、オンライン時/未同期時に自動同期する。
 */
import { useEffect, useState } from 'react';
import { useSyncStore } from '@/lib/sync/syncStore';
import { getRemoteSync } from '@/lib/sync/remote';
import { syncNow, refreshPending } from '@/lib/sync/syncEngine';
import { subscribeOnline, isOnline } from '@/lib/sync/network';

function fmtTime(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SyncStatus() {
  const { online, syncing, pending, lastSyncedAt, error, enabled } = useSyncStore();
  const setOnline = useSyncStore((s) => s.setOnline);
  const setEnabled = useSyncStore((s) => s.setEnabled);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(isOnline());

    const tryAutoSync = async () => {
      const remote = getRemoteSync();
      setEnabled(!!remote);
      if (!remote) return;
      await refreshPending();
      const st = useSyncStore.getState();
      if (st.online && !st.syncing && (st.pending || st.lastSyncedAt === null)) {
        syncNow(remote).catch(() => {});
      }
    };

    // 起動時に1回 + オンライン復帰時 + 定期的に同期を試行
    tryAutoSync();
    const unsub = subscribeOnline((v) => { setOnline(v); if (v) tryAutoSync(); });
    const timer = setInterval(tryAutoSync, 8000);

    return () => { unsub(); clearInterval(timer); };
  }, [setOnline, setEnabled]);

  // SSR/初期ハイドレーション差異を避ける
  if (!mounted || !enabled) return null;

  const manualSync = () => {
    const remote = getRemoteSync();
    if (remote) syncNow(remote).catch(() => {});
  };

  const dotColor = !online ? '#9ca3af' : error ? '#ef4444' : pending ? '#f59e0b' : '#22c55e';
  const label = syncing
    ? '同期中…'
    : !online
      ? 'オフライン'
      : error
        ? '同期エラー'
        : pending
          ? '未同期'
          : `同期済み ${fmtTime(lastSyncedAt)}`;

  return (
    <button
      type="button"
      onClick={manualSync}
      title={error ?? (online ? '今すぐ同期' : 'オフライン（復帰時に自動同期）')}
      className="flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: dotColor, animation: syncing ? 'pulse 1s infinite' : undefined }}
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

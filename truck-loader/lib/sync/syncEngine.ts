/**
 * 同期エンジン（フェーズ4）。データセット単位の Last-Write-Wins。
 *
 * syncNow():
 *   1) リモートの pull と ローカルの export を取得
 *   2) LWW判定:
 *      - リモートが新しい → ローカルをリモートで置換（importSnapshot）＋ アプリ再ロード
 *      - ローカルが新しい/未送信あり → リモートへ push ＋ 同期済み記録
 *      - 同一 → 何もしない（同期済み記録のみ）
 *   3) 同期ストアを更新
 *
 * 競合は updatedAt の大小で解決（収束は保証）。同時編集の field 単位マージは将来拡張。
 */
import type { RemoteSync, LocalSyncApi } from './types';
import { localDataSource } from '../dataSource/localDataSource';
import { useAppStore } from '../store';
import { useSyncStore } from './syncStore';

const local: LocalSyncApi = localDataSource;

let inFlight: Promise<void> | null = null;

/** 1回分の同期を実行（多重起動は1本に集約） */
export function syncNow(remote: RemoteSync): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runSync(remote).finally(() => { inFlight = null; });
  return inFlight;
}

async function runSync(remote: RemoteSync): Promise<void> {
  const s = useSyncStore.getState();
  s.setSyncing(true);
  s.setError(null);
  try {
    const [remoteSnap, localSnap, meta] = await Promise.all([
      remote.pull(),
      local.exportSnapshot(),
      local.getSyncMeta(),
    ]);

    const remoteAt = remoteSnap?.updatedAt ?? -1;
    const localAt = localSnap.updatedAt;

    if (remoteSnap && remoteAt > localAt) {
      // リモートが新しい → 取り込み、アプリのメモリ状態も更新
      await local.importSnapshot(remoteSnap);
      await useAppStore.getState().loadFromDB();
    } else if (meta.dirty || localAt > remoteAt) {
      // ローカルが新しい/未送信あり → 送信
      await remote.push(localSnap);
      await local.markSynced(localAt);
    } else {
      // 同一内容 → 同期済みとして記録
      await local.markSynced(localAt);
    }

    const after = await local.getSyncMeta();
    useSyncStore.getState().setPending(after.dirty);
    useSyncStore.getState().setLastSyncedAt(after.lastSyncedAt);
  } catch (err) {
    useSyncStore.getState().setError(err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    useSyncStore.getState().setSyncing(false);
  }
}

/** 現在の dirty 状態を同期ストアへ反映（UI更新用） */
export async function refreshPending(): Promise<void> {
  const meta = await local.getSyncMeta();
  useSyncStore.getState().setPending(meta.dirty);
  useSyncStore.getState().setLastSyncedAt(meta.lastSyncedAt);
}

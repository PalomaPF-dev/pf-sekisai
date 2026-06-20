/**
 * 同期状態のグローバルストア（フェーズ4）。UI（SyncStatus）が購読する。
 */
import { create } from 'zustand';

interface SyncState {
  online: boolean;
  syncing: boolean;
  /** 未同期の変更があるか（dirty） */
  pending: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  /** 同期機能が有効か（リモート設定済みか） */
  enabled: boolean;

  setOnline: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setPending: (v: boolean) => void;
  setLastSyncedAt: (v: number | null) => void;
  setError: (v: string | null) => void;
  setEnabled: (v: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  pending: false,
  lastSyncedAt: null,
  error: null,
  enabled: false,

  setOnline: (v) => set({ online: v }),
  setSyncing: (v) => set({ syncing: v }),
  setPending: (v) => set({ pending: v }),
  setLastSyncedAt: (v) => set({ lastSyncedAt: v }),
  setError: (v) => set({ error: v }),
  setEnabled: (v) => set({ enabled: v }),
}));

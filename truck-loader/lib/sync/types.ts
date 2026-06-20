/**
 * 同期エンジンの型定義（フェーズ4）。
 *
 * 方針: データセット単位の Last-Write-Wins（LWW）同期。
 *   - 端末ローカル(LocalDataSource)の変更で updatedAt を更新し dirty を立てる
 *   - オンライン復帰時に pull → LWW判定 → 必要なら push
 *   - 競合は「新しい updatedAt が勝つ」（データセット単位）
 *
 * ※ 初期実装はデータセット単位LWW（収束は保証されるが、別端末の同時編集は
 *   新しい側で上書きされる）。将来コレクション/レコード単位マージへ拡張する。
 */

/** 同期で送受信するデータセットのスナップショット */
export interface DatasetSnapshot {
  /** LocalDB のコレクション群（meta を除いた本体） */
  data: Record<string, unknown>;
  /** このスナップショットの最終更新時刻（epoch ms） */
  updatedAt: number;
}

/** リモート（サーバー）との同期インターフェース。実装を差し替え可能にする。 */
export interface RemoteSync {
  /** サーバーの最新スナップショットを取得（無ければ null） */
  pull(): Promise<DatasetSnapshot | null>;
  /** ローカルのスナップショットをサーバーへ送信 */
  push(snapshot: DatasetSnapshot): Promise<void>;
}

/** ローカルの同期メタ情報 */
export interface SyncMeta {
  /** ローカルデータの最終更新時刻（epoch ms） */
  updatedAt: number;
  /** 最後の同期以降に未送信の変更があるか */
  dirty: boolean;
  /** 最後に同期できた時刻（epoch ms / 未同期は null） */
  lastSyncedAt: number | null;
}

/** ローカルデータソースが同期のために公開するAPI */
export interface LocalSyncApi {
  exportSnapshot(): Promise<DatasetSnapshot>;
  importSnapshot(snap: DatasetSnapshot): Promise<void>;
  getSyncMeta(): Promise<SyncMeta>;
  markSynced(updatedAt: number): Promise<void>;
}

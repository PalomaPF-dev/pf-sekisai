/**
 * モックリモート（フェーズ4の検証用）。
 * 同一ブラウザ内の IndexedDB 別キーに「サーバー側スナップショット」を保持し、
 * 実サーバー無しで同期エンジンの pull/push・LWW 収束を検証できる。
 *
 * 本番では httpRemote（/api/sync/*）に差し替える。
 */
import type { RemoteSync, DatasetSnapshot } from './types';
import { idbGet, idbSet } from '../dataSource/idbKv';

const SERVER_KEY = 'mock-server-dataset';

export const mockRemote: RemoteSync = {
  async pull(): Promise<DatasetSnapshot | null> {
    const snap = await idbGet<DatasetSnapshot>(SERVER_KEY);
    return snap ?? null;
  },
  async push(snapshot: DatasetSnapshot): Promise<void> {
    await idbSet(SERVER_KEY, snapshot);
  },
};

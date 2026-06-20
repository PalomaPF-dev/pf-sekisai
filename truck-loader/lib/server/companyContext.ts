/**
 * company_id のコンテキスト注入（サーバー専用）。
 *
 * 通常 db.ts の各関数は getServerSession から company_id を得るが、ネイティブの
 * Bearer認証経由（/api/sync/*）ではセッションが無い。そこで AsyncLocalStorage で
 * company_id を一時的に上書きし、db.ts の既存ロジック（SQLマッピング）をそのまま
 * 再利用できるようにする。db.ts の getCompanyId() がこの override を最優先で参照する。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<string>();

/** companyId を固定して fn を実行（db.ts 呼び出しがこの companyId で動く） */
export function runWithCompany<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  return store.run(companyId, fn);
}

/** 現在の override companyId（無ければ undefined） */
export function getOverrideCompanyId(): string | undefined {
  return store.getStore();
}

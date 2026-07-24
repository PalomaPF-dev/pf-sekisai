/**
 * company_id のコンテキスト注入（サーバー専用）。
 *
 * 通常 db.ts の各関数は getServerSession から company_id を得るが、ネイティブの
 * Bearer認証経由（/api/sync/*）ではセッションが無い。そこで AsyncLocalStorage で
 * company_id を一時的に上書きし、db.ts の既存ロジック（SQLマッピング）をそのまま
 * 再利用できるようにする。db.ts の getCompanyId() がこの override を最優先で参照する。
 *
 * 併せて工場スコープ（部署＝工場によるデータ表示制限）の解決結果も持ち回る。
 * ここに載せた工場コードを db.ts の読み書きがそのまま使うため、同期経路でも
 * セッション経路と同じ絞り込みが効く。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface CompanyContext {
  companyId: string;
  /**
   * 解決済みの工場コード。undefined/null = 制限なし（全工場）。
   * NO_FACTORY_MATCH（''）= 部署名に一致する工場が無い＝空表示。
   */
  factoryScopeCode?: string | null;
}

const store = new AsyncLocalStorage<CompanyContext>();

/** companyId（＋工場スコープ）を固定して fn を実行（db.ts 呼び出しがこの文脈で動く） */
export function runWithCompany<T>(
  companyId: string,
  fn: () => Promise<T>,
  factoryScopeCode?: string | null,
): Promise<T> {
  return store.run({ companyId, factoryScopeCode }, fn);
}

/** 現在の override companyId（無ければ undefined） */
export function getOverrideCompanyId(): string | undefined {
  return store.getStore()?.companyId;
}

/** override コンテキスト全体（無ければ undefined） */
export function getOverrideContext(): CompanyContext | undefined {
  return store.getStore();
}

/**
 * サブスク(RevenueCat)エンタイトルメントのサーバ側ロジック。
 *
 * モデル: 会社(company)単位のサブスク。RevenueCat の appUserID には companyId を使う。
 *   - iOS で購入 → RevenueCat → Webhook(/api/webhooks/revenuecat) → companies を更新
 *   - Web/iOS とも companies.is_pro を参照してロック解除（iOS はSDKの即時反映も併用）
 */
import { sql } from '../neon';

export const PRO_ENTITLEMENT = 'pro';

export interface CompanySubscription {
  isPro: boolean;
  plan: string | null;          // 'monthly' | 'annual' | null
  store: string | null;
  productId: string | null;
  expiresAt: string | null;     // ISO
}

/** companies からサブスク状態を取得。期限切れは is_pro=false として扱う。 */
export async function getCompanySubscription(companyId: string): Promise<CompanySubscription> {
  const rows = await sql`
    SELECT is_pro, subscription_plan, subscription_store, subscription_product_id, subscription_expires_at
    FROM companies WHERE id = ${companyId}
  `;
  const r = rows[0];
  if (!r) return { isPro: false, plan: null, store: null, productId: null, expiresAt: null };
  const expiresAt: Date | null = r.subscription_expires_at ? new Date(r.subscription_expires_at) : null;
  const notExpired = !expiresAt || expiresAt.getTime() > Date.now();
  return {
    isPro: Boolean(r.is_pro) && notExpired,
    plan: r.subscription_plan ?? null,
    store: r.subscription_store ?? null,
    productId: r.subscription_product_id ?? null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}

/** product_id からプラン種別(monthly/annual)を推定 */
function inferPlan(productId: string | null | undefined): string | null {
  if (!productId) return null;
  const p = productId.toLowerCase();
  if (/(annual|year|yearly|12m|1y)/.test(p)) return 'annual';
  if (/(month|monthly|1m)/.test(p)) return 'monthly';
  return null;
}

// RevenueCat Webhook event types
//   https://www.revenuecat.com/docs/webhooks
const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE',
]);
const INACTIVE_TYPES = new Set([
  'EXPIRATION', 'SUBSCRIPTION_PAUSED',
]);
// CANCELLATION は自動更新OFFだが期限まで有効 → ダウングレードしない

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[];
  store?: string;
  expiration_at_ms?: number;
}

/**
 * RevenueCat Webhook イベントを companies に反映。
 * app_user_id = companyId（購入時に設定）。pro エンタイトルメントの有効/無効を判定。
 * @returns 反映できたか
 */
export async function applyRevenueCatEvent(event: RevenueCatEvent): Promise<boolean> {
  const type = event.type ?? '';
  // companyId 候補（app_user_id 優先、original/alias もフォールバック）
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]
    .filter((v): v is string => Boolean(v) && v !== '$RCAnonymousID');
  if (candidates.length === 0) return false;

  // pro 以外のエンタイトルメントしか含まないイベントは無視（設定で 'pro' を使う想定）
  const touchesPro = !event.entitlement_ids || event.entitlement_ids.length === 0 || event.entitlement_ids.includes(PRO_ENTITLEMENT);
  if (!touchesPro) return false;

  let isPro: boolean | null = null;
  if (ACTIVE_TYPES.has(type)) isPro = true;
  else if (INACTIVE_TYPES.has(type)) isPro = false;
  else if (type === 'CANCELLATION') isPro = null; // 期限までは維持
  else isPro = null; // TRANSFER/BILLING_ISSUE 等は状態変更しない

  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const plan = inferPlan(event.product_id);

  let updated = false;
  for (const companyId of candidates) {
    if (isPro === null) {
      // 状態は変えず、メタ情報（期限/product/store）のみ更新
      const res = await sql`
        UPDATE companies SET
          subscription_plan = COALESCE(${plan}, subscription_plan),
          subscription_store = COALESCE(${event.store ?? null}, subscription_store),
          subscription_product_id = COALESCE(${event.product_id ?? null}, subscription_product_id),
          subscription_expires_at = COALESCE(${expiresAt ? expiresAt.toISOString() : null}, subscription_expires_at),
          subscription_updated_at = NOW()
        WHERE id = ${companyId}
      `;
      if (Array.isArray(res) ? false : true) updated = true;
    } else {
      await sql`
        UPDATE companies SET
          is_pro = ${isPro},
          subscription_plan = ${plan},
          subscription_store = ${event.store ?? null},
          subscription_product_id = ${event.product_id ?? null},
          subscription_expires_at = ${expiresAt ? expiresAt.toISOString() : null},
          subscription_updated_at = NOW()
        WHERE id = ${companyId}
      `;
      updated = true;
    }
  }
  return updated;
}

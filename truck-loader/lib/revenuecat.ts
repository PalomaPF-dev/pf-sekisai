/**
 * RevenueCat（@revenuecat/purchases-capacitor）のネイティブ専用ラッパー。
 * Web では何もしない（Web のエンタイトルメントはサーバ /api/subscription/status を参照）。
 *
 * appUserID には companyId を使う（会社単位のサブスク）。
 * 公開SDKキー: NEXT_PUBLIC_RC_IOS_API_KEY（RevenueCat ダッシュボードの Apple App 公開キー）
 */
import { Capacitor } from '@capacitor/core';

export const PRO_ENTITLEMENT = 'pro';

export interface UpgradePackage {
  identifier: string;          // RevenueCat package id
  plan: 'monthly' | 'annual' | 'other';
  priceString: string;         // 表示用（例 "¥1,200"）
  productId: string;
  raw: unknown;                // purchasePackage に渡す元オブジェクト
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

let configured = false;

/** RevenueCat を初期化（ネイティブのみ・1回） */
export async function configureRevenueCat(companyId: string): Promise<void> {
  if (!isNative()) return;
  const apiKey = process.env.NEXT_PUBLIC_RC_IOS_API_KEY;
  if (!apiKey) { console.warn('[revenuecat] NEXT_PUBLIC_RC_IOS_API_KEY 未設定'); return; }
  const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
  if (!configured) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey, appUserID: companyId });
    configured = true;
  } else {
    // ログイン中の会社が変わった場合に備えて切替
    try { await Purchases.logIn({ appUserID: companyId }); } catch { /* ignore */ }
  }
}

/** pro エンタイトルメントが有効か（ネイティブSDKの即時判定） */
export async function nativeIsPro(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]);
  } catch {
    return false;
  }
}

/** 現在のオファリングの購入パッケージ（月額・年額）を取得 */
export async function getUpgradePackages(): Promise<UpgradePackage[]> {
  if (!isNative()) return [];
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    return pkgs.map((p) => {
      const ptype = (p.packageType || '').toUpperCase();
      const plan: UpgradePackage['plan'] =
        ptype.includes('ANNUAL') ? 'annual' : ptype.includes('MONTHLY') ? 'monthly' : 'other';
      return {
        identifier: p.identifier,
        plan,
        priceString: p.product?.priceString ?? '',
        productId: p.product?.identifier ?? '',
        raw: p,
      };
    });
  } catch (e) {
    console.warn('[revenuecat] getOfferings 失敗', e);
    return [];
  }
}

/** パッケージを購入。成功で pro 有効化されたら true */
export async function purchaseUpgrade(pkg: UpgradePackage): Promise<{ ok: boolean; isPro: boolean; message?: string }> {
  if (!isNative()) return { ok: false, isPro: false, message: 'ネイティブアプリでのみ購入できます' };
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const res = await Purchases.purchasePackage({ aPackage: pkg.raw as never });
    const isPro = Boolean(res.customerInfo.entitlements.active[PRO_ENTITLEMENT]);
    return { ok: true, isPro };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { ok: false, isPro: false, message: 'cancelled' };
    return { ok: false, isPro: false, message: err.message ?? '購入に失敗しました' };
  }
}

/** 購入の復元（機種変更・再インストール時） */
export async function restorePurchases(): Promise<{ ok: boolean; isPro: boolean; message?: string }> {
  if (!isNative()) return { ok: false, isPro: false, message: 'ネイティブアプリでのみ利用できます' };
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.restorePurchases();
    return { ok: true, isPro: Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]) };
  } catch (e) {
    return { ok: false, isPro: false, message: (e as Error).message };
  }
}

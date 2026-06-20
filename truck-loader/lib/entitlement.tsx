'use client';

/**
 * サブスク・エンタイトルメントのクライアント状態。
 *
 * 判定の出どころ:
 *   - ネイティブ(iOS): RevenueCat SDK の pro エンタイトルメント（即時・オフライン可）
 *   - Web: サーバ /api/subscription/status（RevenueCat Webhook で更新済みの会社状態）
 *
 * 使い方:
 *   const { isPro } = useEntitlement();
 *   const { requirePro } = useUpgrade();
 *   onClick={() => { if (!requirePro('PDF出力')) return; doExport(); }}
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { syncApiBase, authHeader } from '@/lib/auth/cloudAuth';
import { getToken } from '@/lib/auth/token';
import {
  isNative, configureRevenueCat, nativeIsPro,
  getUpgradePackages, purchaseUpgrade, restorePurchases, type UpgradePackage,
} from '@/lib/revenuecat';
import { UpgradeModal } from '@/components/UpgradeModal';
import { toast } from '@/components/Toast';

interface EntitlementState {
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  requirePro: (feature: string) => boolean;
  openUpgrade: (feature?: string) => void;
}

const Ctx = createContext<EntitlementState | null>(null);

/** JWT(token) の payload から companyId を取り出す（検証はしない・appUserID用） */
function companyIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.companyId ? String(payload.companyId) : null;
  } catch {
    return null;
  }
}

async function fetchServerIsPro(): Promise<boolean> {
  try {
    const token = await getToken();
    const res = await fetch(`${syncApiBase()}/api/subscription/status`, {
      headers: { ...authHeader(token) },
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.isPro);
  } catch {
    return false;
  }
}

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalFeature, setModalFeature] = useState<string | null>(null);
  const [packages, setPackages] = useState<UpgradePackage[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isNative()) {
        const token = await getToken();
        const companyId = companyIdFromToken(token);
        if (companyId) await configureRevenueCat(companyId);
        const [native, server] = await Promise.all([nativeIsPro(), fetchServerIsPro()]);
        setIsPro(native || server);
      } else {
        setIsPro(await fetchServerIsPro());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // 同期エンジン(getRemoteSync)が参照できるよう、エンタイトルメントをキャッシュ
  useEffect(() => {
    try { window.localStorage.setItem('truckloader.isPro', isPro ? '1' : '0'); } catch { /* ignore */ }
  }, [isPro]);

  const openUpgrade = useCallback((feature?: string) => {
    setModalFeature(feature ?? '');
    if (isNative()) void getUpgradePackages().then(setPackages);
  }, []);

  const requirePro = useCallback((feature: string): boolean => {
    if (isPro) return true;
    openUpgrade(feature);
    return false;
  }, [isPro, openUpgrade]);

  const handlePurchase = useCallback(async (pkg: UpgradePackage) => {
    setBusy(true);
    const res = await purchaseUpgrade(pkg);
    setBusy(false);
    if (res.ok && res.isPro) {
      setIsPro(true);
      setModalFeature(null);
      toast('✓ プロにアップグレードしました。ありがとうございます！', 'success');
      void refresh();
    } else if (res.message && res.message !== 'cancelled') {
      toast(res.message, 'error');
    }
  }, [refresh]);

  const handleRestore = useCallback(async () => {
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok && res.isPro) {
      setIsPro(true);
      setModalFeature(null);
      toast('✓ 購入を復元しました', 'success');
    } else {
      toast('復元できる購入が見つかりませんでした', 'info');
    }
  }, []);

  return (
    <Ctx.Provider value={{ isPro, loading, refresh, requirePro, openUpgrade }}>
      {children}
      <UpgradeModal
        open={modalFeature !== null}
        feature={modalFeature ?? ''}
        native={isNative()}
        packages={packages}
        busy={busy}
        onPurchase={handlePurchase}
        onRestore={handleRestore}
        onClose={() => setModalFeature(null)}
      />
    </Ctx.Provider>
  );
}

export function useEntitlement(): EntitlementState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Provider外で呼ばれた場合の安全なフォールバック（Pro扱いにはしない）
    return {
      isPro: false, loading: false,
      refresh: async () => {}, requirePro: () => false, openUpgrade: () => {},
    };
  }
  return ctx;
}

export function useUpgrade(): Pick<EntitlementState, 'requirePro' | 'openUpgrade' | 'isPro'> {
  const { requirePro, openUpgrade, isPro } = useEntitlement();
  return { requirePro, openUpgrade, isPro };
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

/**
 * ネイティブ(iOS)アプリで開かれた場合に指定先へリダイレクトする（Webでは何もしない）。
 * App Store ガイドライン3.1.1対応：料金/お問い合わせ等の外部課金導線ページを
 * ネイティブから到達不能にする。Web では従来どおり表示（サポートURL要件も維持）。
 */
export default function NativeRedirect({ to = '/login' }: { to?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (Capacitor.isNativePlatform()) router.replace(to);
  }, [router, to]);
  return null;
}

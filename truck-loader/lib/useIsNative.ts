'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * ネイティブ(iOS/Capacitor)アプリ内で動作しているか。
 * App Store ガイドライン3.1.1対応：ネイティブでは料金/契約/お問い合わせ等の
 * 外部課金導線を出さないため、この判定で出し分ける。
 * （SSR/Webでは false。マウント後に確定するため初回 false→再レンダー）
 */
export function useIsNative(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(Capacitor.isNativePlatform());
  }, []);
  return native;
}

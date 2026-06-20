'use client';

/**
 * 起動時に画面を横向きに固定する（ネイティブのみ）。layout に1つ置く。
 * Web では何もしない。
 */
import { useEffect } from 'react';
import { lockLandscape } from '@/lib/orientation';

export function OrientationController() {
  useEffect(() => {
    lockLandscape();
  }, []);
  return null;
}

'use client';

/**
 * デモ（閲覧専用）モードの共通判定とガード。
 *
 * デモ = 無ログインのローカルプレビュー。
 *   - Web   : Cookie `truckloader.demo=1`（app/login の「デモを見る」で付与）
 *   - ネイティブ: localStorage `truckloader.demoNative='1'`（TrialGate の demo() で付与）
 *
 * デモでは「閲覧・操作（積載計算）・PDF出力」のみ許可し、
 * データの作成/編集/削除/CSV取込/保存は一切できない（＝閲覧専用）。
 * 判定ロジックは components/TrialGate.tsx の isDemo() と同一に保つ。
 */
import { useEffect, useState } from 'react';

/** デモ時にユーザーへ表示するナッジ文言。 */
export const DEMO_READONLY_MESSAGE = 'デモは閲覧専用です。無料登録でご利用ください';

/** 書込ブロック時に throw されるエラーの識別用。store 側の catch で握りつぶす。 */
export const DEMO_BLOCKED_ERROR = '__DEMO_READONLY__';

/**
 * 現在デモ（閲覧専用）モードかどうか。SSR では常に false。
 * Cookie（Web）と localStorage（ネイティブ）の両フラグを見る。
 */
export function isDemoMode(): boolean {
  try {
    if (typeof document !== 'undefined' && document.cookie.includes('truckloader.demo=1')) return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('truckloader.demoNative') === '1') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * デモなら true を返し、ナッジのトーストを表示する（＝呼び出し側は早期 return する）。
 * UI ハンドラの先頭で `if (notifyDemoBlocked()) return;` の形で使う。
 */
export function notifyDemoBlocked(): boolean {
  if (!isDemoMode()) return false;
  // Toast への依存を避けるため動的 import（循環参照防止 & SSR安全）。
  import('@/components/Toast')
    .then(({ toast }) => toast(DEMO_READONLY_MESSAGE, 'info'))
    .catch(() => { /* トースト失敗時も静かにブロックは継続 */ });
  return true;
}

/**
 * データ書込層（LocalDataSource）の安全網。
 * デモならナッジを出して既知のエラーを throw する。
 */
export function assertNotDemo(): void {
  if (isDemoMode()) {
    notifyDemoBlocked();
    throw new Error(DEMO_BLOCKED_ERROR);
  }
}

/** React コンポーネントからデモ状態を購読する（マウント後に確定）。 */
export function useDemo(): boolean {
  const [demo, setDemo] = useState(false);
  useEffect(() => { setDemo(isDemoMode()); }, []);
  return demo;
}

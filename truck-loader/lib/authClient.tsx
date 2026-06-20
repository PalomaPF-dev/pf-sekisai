'use client';

/**
 * 認証クライアントのラッパー。
 *
 * ビルド種別に応じて実装を切り替える:
 *   - 通常（Web/Vercel）   → 本物の next-auth/react
 *   - Capacitor（オフライン）→ ローカルスタブ（セッションfetchをしない）
 *
 * 切替は NEXT_PUBLIC_CAPACITOR（build-capacitor.mjs が '1' を注入）で行う。
 * webpack エイリアスはこのプロジェクトでは安定して効かなかったため、
 * 実行時切替（ビルド時にenvがインライン展開される）で確実に分岐させる。
 *
 * 認証を使う画面（login / UserMenu / SessionProvider）はすべて
 * 'next-auth/react' ではなく本モジュールから import すること。
 */
import * as real from 'next-auth/react';
import * as offline from './next-auth-react.capacitor-stub';

const impl = process.env.NEXT_PUBLIC_CAPACITOR === '1' ? offline : real;

// 型は本物の next-auth/react に合わせる（呼び出し側のコードは無改修で済む）。
// 実体はビルド時に決まる impl（通常=real / Capacitor=offline）。
export const SessionProvider: typeof real.SessionProvider = impl.SessionProvider as typeof real.SessionProvider;
export const useSession: typeof real.useSession = impl.useSession as typeof real.useSession;
export const signIn: typeof real.signIn = impl.signIn as typeof real.signIn;
export const signOut: typeof real.signOut = impl.signOut as typeof real.signOut;

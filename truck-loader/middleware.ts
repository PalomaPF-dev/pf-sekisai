import { withAuth } from 'next-auth/middleware';

/**
 * 本アプリは「無料・ローカルファースト」。ページはログイン不要で利用でき（ローカルモード）、
 * ログインはクラウド同期のための任意機能。したがってミドルウェアでのログイン強制は行わない。
 * - ページ: 認証不要（全許可）。
 * - サーバアクション(lib/db.ts)/API(/api/sync・account・push 等): それぞれが getAuthContext で
 *   自前にセッション/Bearerを検証するため、ミドルウェアの保護は不要。
 */
export default withAuth({
  callbacks: {
    authorized: () => true, // 常に許可（リダイレクトしない）
  },
});

export const config = {
  // 実質無効化（静的アセット等のみ対象。authorized が常に true のため何もしない）
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

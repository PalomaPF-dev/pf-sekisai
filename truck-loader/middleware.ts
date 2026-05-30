export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    /*
     * /login, /register, /api/auth/* 以外の全ルートを保護
     * next.js の静的ファイル (_next/static, favicon.ico など) は除外
     */
    '/((?!login|register|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico)).*)',
  ],
};

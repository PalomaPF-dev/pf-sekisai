/**
 * サーバー側の認証コンテキスト解決（フェーズ4/6 残作業：ネイティブのトークン認証）。
 *
 * 保護APIは getAuthContext(req) を使い、以下のどちらでも認証できる:
 *   - Bearer トークン（ネイティブアプリ）… /api/auth/token が発行したJWTを検証
 *   - Cookie セッション（Web）… 既存の NextAuth セッション
 *
 * JWT署名鍵は NEXTAUTH_SECRET を流用（NextAuthと同一シークレット）。
 */
import { getServerSession } from 'next-auth';
import { SignJWT, jwtVerify } from 'jose';
import { authOptions } from '@/lib/authOptions';

export interface AuthCtx {
  userId: string;
  companyId: string;
  companyName?: string;
  /** 'admin' のみマスタ（工場/製品/倉庫/トラック/パレット種別）を書き換え可能。未設定は 'member' 相当。 */
  role?: 'admin' | 'member';
}

function secretKey(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET が未設定です（トークン認証に必要）');
  return new TextEncoder().encode(s);
}

/** ログインユーザー情報から30日有効のアクセストークン（JWT/HS256）を発行 */
export async function signAuthToken(ctx: AuthCtx): Promise<string> {
  return new SignJWT({ companyId: ctx.companyId, companyName: ctx.companyName ?? null, role: ctx.role ?? 'member' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ctx.userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey());
}

/** リクエストから認証コンテキストを解決（Bearer優先、無ければCookieセッション） */
export async function getAuthContext(req: Request): Promise<AuthCtx | null> {
  // 1) Bearer トークン（ネイティブ）
  const authz = req.headers.get('authorization');
  if (authz && authz.startsWith('Bearer ')) {
    try {
      const { payload } = await jwtVerify(authz.slice(7), secretKey());
      if (payload.sub && payload.companyId) {
        return {
          userId: String(payload.sub),
          companyId: String(payload.companyId),
          companyName: payload.companyName ? String(payload.companyName) : undefined,
          role: payload.role === 'admin' ? 'admin' : 'member',
        };
      }
    } catch {
      /* 無効トークン → Cookieにフォールバック */
    }
  }

  // 2) Cookie セッション（Web）
  const session = await getServerSession(authOptions);
  if (session?.user?.companyId) {
    return {
      userId: String(session.user.id ?? ''),
      companyId: String(session.user.companyId),
      companyName: session.user.companyName,
      role: session.user.role === 'admin' ? 'admin' : 'member',
    };
  }

  return null;
}

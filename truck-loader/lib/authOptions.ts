import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { ensureAuthSchema } from './authDb';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');
  return neon(url);
}

/**
 * 社員番号（login_id）を優先し、無ければ従来どおりメールアドレスで検索する。
 * login_id / pending 列が未追加の既存DBでも動くよう、失敗したら ensureAuthSchema で
 * 冪等にマイグレーションしてから1回だけリトライする（既存メールアカウントも継続ログイン可）。
 */
async function lookupUser(sql: ReturnType<typeof getDb>, rawId: string) {
  let rows = await sql`
    SELECT u.id, u.email, u.name, u.password_hash, u.pending, u.role,
           c.id AS company_id, c.name AS company_name
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.login_id = ${rawId}
    LIMIT 1
  `;
  if (rows.length === 0) {
    rows = await sql`
      SELECT u.id, u.email, u.name, u.password_hash, u.pending, u.role,
             c.id AS company_id, c.name AS company_name
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE u.email = ${rawId.toLowerCase()}
      LIMIT 1
    `;
  }
  return rows;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        // フィールド名は互換のため email のまま（中身は社員番号 or 従来のメールアドレス）
        email: { label: '社員番号', type: 'text' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const sql = getDb();
        const rawId = credentials.email.trim();
        let rows;
        try {
          rows = await lookupUser(sql, rawId);
        } catch {
          // login_id / pending 列が未作成の既存DB（42703）などは冪等追加してリトライ。
          // それでも失敗（users/companies 未作成など）はログイン失敗扱い。
          try {
            await ensureAuthSchema();
            rows = await lookupUser(sql, rawId);
          } catch {
            return null;
          }
        }

        const user = rows[0];
        if (!user) return null;

        // 招待中（パスワード未設定）はログイン不可。メッセージは signIn の res.error に載る。
        if (user.pending) {
          throw new Error('初回ログインのため、パスワードの設定が必要です。ログイン画面の「初めてログインする方はこちら」からパスワードを設定してください。');
        }

        const valid = await bcrypt.compare(credentials.password, user.password_hash as string);
        if (!valid) return null;

        return {
          id: user.id as string,
          email: (user.email as string | null) ?? '',
          name: user.name as string,
          companyId: user.company_id as string,
          companyName: user.company_name as string,
          // マスタ設定の編集可否に使用。未設定の既存DBは 'member' 相当（安全側）。
          role: ((user.role as string | null) ?? 'member') as 'admin' | 'member',
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.role = user.role ?? 'member';
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.companyId = token.companyId;
      session.user.companyName = token.companyName;
      session.user.role = token.role ?? 'member';
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
};

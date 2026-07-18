import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sql } from './neon';

/**
 * 認証用テーブル（companies/users）を社員番号ログインに対応させるための冪等マイグレーション。
 * pf-keisoku の authDb.ts を sekisai の db 層（./neon の sql）に合わせて移植したもの。
 *   - users.login_id（社員番号ログイン用・UNIQUE）
 *   - users.pending（招待中＝パスワード未設定でログイン不可）
 *   - email を任意項目化（NOT NULL 解除）
 *   - 既存ユーザーは email をそのまま login_id にバックフィル
 * 空DBでも自動初期化されるよう companies/users も冪等に作成する。
 */
export async function ensureAuthSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id)`;
  // 招待（管理者がアカウントを発行する）モデル用の列（冪等追加）。
  // pending=true は招待済み・パスワード未設定。
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT false`;
  // 役割（ポータル provision v2 で連携・冪等追加）。admin=管理者 / member=一般。
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`;
  // 承認者の社員番号（ポータル provision v2 で連携・冪等追加）。NULL = 未設定。
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS approver_login_id TEXT`;
  // 社員番号ログイン用の login_id 列（冪等追加）。メールアドレスは任意項目に変更（NOT NULL 解除）。
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_login_id_idx ON users(login_id)`;
  await sql`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`;
  // バックフィル: 既存ユーザーは従来のメール文字列をそのまま社員番号としてログイン可能に。
  await sql`UPDATE users SET login_id = email WHERE login_id IS NULL AND email IS NOT NULL`;
}

// ポータル一括発行の発行先会社（PF社内展開・全アプリ共通の固定値）
const PROVISION_COMPANY_NAME = '株式会社パロマ';

/**
 * 会社名で会社を取得し、無ければ作成して ID を返す（get-or-create）。
 * 既存があれば必ず再利用する（同名が複数あっても最古の1社に寄せる）。ポータル一括発行(provision)用。
 * 社内展開の会社はトライアル制限を受けないよう十分先の trial_ends_at を付与する。
 */
export async function getOrCreateCompanyByName(name: string): Promise<string> {
  const rows = await sql`
    SELECT id FROM companies WHERE name = ${name}
    ORDER BY created_at ASC LIMIT 1`;
  const existing = rows[0]?.id as string | undefined;
  if (existing) return existing;
  const created = await sql`
    INSERT INTO companies (name, trial_ends_at)
    VALUES (${name}, NOW() + INTERVAL '3650 days')
    RETURNING id`;
  return created[0].id as string;
}

/**
 * 招待ユーザーを作成（pending=true）。ログインできないランダムなハッシュを設定し、
 * パスワードは招待リンク（/password-reset/confirm）から本人が設定する。作成したIDを返す。
 */
export async function createInvitedUser(
  companyId: string,
  loginId: string,
  email: string | null,
  name: string,
  role: 'admin' | 'member' = 'member',
  approverLoginId: string | null = null,
): Promise<string> {
  // ランダムな使えないパスワード（招待完了までログイン不可）
  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
  const rows = await sql`
    INSERT INTO users (company_id, login_id, email, name, password_hash, pending, role, approver_login_id)
    VALUES (${companyId}, ${loginId}, ${email}, ${name}, ${passwordHash}, true, ${role}, ${approverLoginId})
    RETURNING id
  `;
  return rows[0].id as string;
}

export { PROVISION_COMPANY_NAME };

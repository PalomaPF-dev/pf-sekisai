import { createHash } from 'crypto';
import { sql } from './neon';
import { ensureAuthSchema } from './authDb';

/**
 * パスワード再設定／招待トークン（メールリンク方式）。
 * - トークンは平文をメール（またはポータル）で渡し、DB には SHA-256 ハッシュのみ保存する。
 * - 有効期限つき・used_at で使い捨て。
 * pf-keisoku の passwordReset.ts を sekisai の db 層に合わせて移植したもの。
 */
export const RESET_TOKEN_TTL_MINUTES = 60;

/** password_reset_tokens テーブルを冪等に作成（users への外部キーで退会時も自動削除）。 */
export async function ensurePasswordResetSchema(): Promise<void> {
  await ensureAuthSchema();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
  } catch {
    /* 同時実行によるカタログ競合（既に存在）は無視 */
  }
}

/** トークン平文 → DB 保存用の SHA-256 ハッシュ */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

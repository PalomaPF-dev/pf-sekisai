import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/neon';
import { ensureAuthSchema } from '@/lib/authDb';

export const runtime = 'nodejs';

/**
 * POST /api/first-login — 初回パスワード設定（招待中＝pending ユーザーの自己設定）。
 * ポータル管理者が社員番号のみで発行したアカウント（メール無し）でも、本人が
 * 社員番号＋新パスワードでアカウントを有効化できるようにする。
 * 設定完了で pending=false となり、以後は通常ログイン可能。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const loginId = (body.loginId ?? '').toString().trim();
    const password = (body.password ?? '').toString();

    // login_id / pending 列を冪等に用意（失敗しても既存DBならそのまま照会できる）
    try {
      await ensureAuthSchema();
    } catch (err) {
      console.warn('[first-login] ensureAuthSchema failed:', err);
    }

    // authorize() と同じ2段階検索：①社員番号（login_id）→ ②後方互換で email
    let rows = await sql`SELECT id, pending FROM users WHERE login_id = ${loginId} LIMIT 1`;
    if (rows.length === 0) {
      rows = await sql`SELECT id, pending FROM users WHERE email = ${loginId.toLowerCase()} LIMIT 1`;
    }
    if (rows.length === 0) {
      return NextResponse.json(
        { error: '該当するアカウントが見つかりません。社員番号をご確認ください。' },
        { status: 404 }
      );
    }

    const user = rows[0];
    // 設定済みアカウントの乗っ取り防止：pending のときだけ無認証で設定を許可する
    if (!user.pending) {
      return NextResponse.json(
        { error: 'このアカウントは既にパスワード設定済みです。ログイン画面からログインしてください。パスワードを忘れた場合は管理者に再発行を依頼してください。' },
        { status: 409 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で設定してください。' },
        { status: 400 }
      );
    }

    // 既存の登録処理と同じ bcryptjs（コスト12）でハッシュ化し、招待完了（pending 解除）
    const passwordHash = await bcrypt.hash(password, 12);
    await sql`UPDATE users SET password_hash = ${passwordHash}, pending = false WHERE id = ${user.id}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[first-login] error:', err);
    return NextResponse.json(
      { error: '設定に失敗しました。時間をおいて再度お試しください。' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/neon';
import { ensurePasswordResetSchema, hashResetToken } from '@/lib/passwordReset';

export const runtime = 'nodejs';

/**
 * POST /api/password-reset/confirm — トークンを検証して新しいパスワードに更新する。
 * トークンは未使用・期限内のみ有効。使用後は used_at を記録して再利用不可にする。
 * 招待（pending）ユーザーはこの設定完了で pending が解除されログイン可能になる。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = (body.token ?? '').toString().trim();
    const password = (body.password ?? '').toString();

    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json(
        { message: 'リンクが正しくありません。メールのリンクをもう一度開いてください。' },
        { status: 400 }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ message: 'パスワードは8文字以上にしてください。' }, { status: 400 });
    }

    await ensurePasswordResetSchema();
    const tokenHash = hashResetToken(token);
    const rows = await sql`
      SELECT t.id, t.user_id, t.expires_at, t.used_at
      FROM password_reset_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ${tokenHash}
      LIMIT 1`;
    const t = rows[0];
    const expired = t ? new Date(t.expires_at as string).getTime() < Date.now() : true;
    if (!t || t.used_at || expired) {
      return NextResponse.json(
        { message: 'このリンクは無効か、有効期限が切れています。お手数ですが、もう一度最初からやり直してください。' },
        { status: 400 }
      );
    }

    // 既存の登録処理（createUser）と同じ bcryptjs / コスト12 でハッシュ化
    const passwordHash = await bcrypt.hash(password, 12);
    // パスワード設定成功で pending も解除（招待完了）。通常のリセットでも false のままで無害。
    await sql`UPDATE users SET password_hash = ${passwordHash}, pending = false WHERE id = ${t.user_id}`;
    await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${t.id}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[password-reset/confirm] error:', err);
    return NextResponse.json({ message: '変更に失敗しました。時間をおいて再度お試しください。' }, { status: 500 });
  }
}

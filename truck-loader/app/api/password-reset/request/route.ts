import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { ensurePasswordResetSchema, hashResetToken, RESET_TOKEN_TTL_MINUTES } from '@/lib/passwordReset';

export const runtime = 'nodejs';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// 簡易レート制限（同一メール / 同一IP で 10 分 5 回まで。in-memory）
const RL = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const WIN = 10 * 60 * 1000;
  const MAX = 5;
  const arr = (RL.get(key) ?? []).filter((t) => now - t < WIN);
  if (arr.length >= MAX) { RL.set(key, arr); return true; }
  arr.push(now);
  RL.set(key, arr);
  return false;
}

/**
 * POST /api/password-reset/request — 再設定メールの送信を受け付ける。
 * ユーザーの存在有無に関わらず常に {ok:true} を返す（メールアドレスの列挙攻撃防止）。
 */
export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? '').toString().toLowerCase().trim();

    if (!email || !isEmail(email) || email.length > 254) {
      return NextResponse.json({ message: 'メールアドレスの形式が正しくありません。' }, { status: 400 });
    }
    if (rateLimited(`ip:${ip}`) || rateLimited(`em:${email}`)) {
      return NextResponse.json({ message: '送信が多すぎます。時間をおいて再度お試しください。' }, { status: 429 });
    }

    await ensurePasswordResetSchema();
    const rows = await sql`
      SELECT u.id, u.name
      FROM users u
      WHERE u.email = ${email}
      LIMIT 1`;
    const user = rows[0];

    // 存在しない場合もここで {ok:true}（結果を悟らせない）
    if (user) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString();
      await sql`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, ${expiresAt})`;

      const base = process.env.NEXTAUTH_URL || 'https://sekisai.paloma-pf.com';
      const link = `${base.replace(/\/$/, '')}/password-reset/confirm?token=${token}`;

      if (process.env.RESEND_API_KEY) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${(process.env.RESEND_API_KEY || '').trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.CONTACT_FROM || process.env.ALERT_MAIL_FROM || 'PF積載 <noreply@paloma-pf.com>',
              to: [email],
              subject: '【PF積載】パスワード再設定のご案内',
              text:
                `${user.name} 様\n\n` +
                `PF積載のパスワード再設定のお申し込みを受け付けました。\n\n` +
                `以下のリンクから60分以内に再設定してください。\n\n${link}\n\n` +
                `心当たりがない場合は、このメールを破棄してください（パスワードは変更されません）。\n\n` +
                `— PF積載`,
              ...(process.env.MAIL_REPLY_TO?.trim() ? { reply_to: process.env.MAIL_REPLY_TO.trim() } : {}),
            }),
          });
          if (!res.ok) {
            const t = (await res.text().catch(() => '')).slice(0, 200);
            console.warn('[password-reset] Resend error', res.status, t);
          }
        } catch (e) {
          console.warn('[password-reset] mail send failed:', (e as Error).message);
        }
      } else {
        console.warn('[password-reset] RESEND_API_KEY 未設定のためメール未送信');
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[password-reset/request] error:', err);
    return NextResponse.json({ message: '送信に失敗しました。時間をおいて再度お試しください。' }, { status: 500 });
  }
}

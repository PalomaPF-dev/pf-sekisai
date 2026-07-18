import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 宛先（ログイン画面の従来 mailto と同じ管理者アドレス）
const CONTACT_TO = 'info@paloma-pf.com';

// 簡易レート制限（同一IPで10分5回まで。in-memory＝インスタンス単位のベストエフォート）
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
 * POST /api/contact-admin — ログイン画面「管理者にお問い合わせ」フォームの送信先（公開API・セッション不要）。
 * メールクライアントが無い端末では mailto リンクが機能しないため、
 * サーバー側（Resend）から管理者宛にメールを送る。website はハニーポット（botが埋めたら黙って成功扱い）。
 */
export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const body = await req.json().catch(() => ({}));

    // ハニーポット: 人間には見えないフィールド。埋まっていたら送信せず成功を返す
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    const message = (body.message ?? '').toString().trim();
    const name = (body.name ?? '').toString().trim();
    const loginId = (body.loginId ?? '').toString().trim();

    if (!message) {
      return NextResponse.json({ error: 'お問い合わせ内容を入力してください' }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: 'お問い合わせ内容は2000文字以内で入力してください' }, { status: 400 });
    }
    if (name.length > 100 || loginId.length > 100) {
      return NextResponse.json({ error: 'お名前・社員番号は100文字以内で入力してください' }, { status: 400 });
    }
    if (rateLimited(`ip:${ip}`)) {
      return NextResponse.json(
        { error: '送信が多すぎます。10分ほど時間をおいて再度お試しください。' },
        { status: 429 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'send-unavailable' }, { status: 503 });
    }

    const base = (process.env.NEXTAUTH_URL || 'https://sekisai.paloma-pf.com').replace(/\/$/, '');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(process.env.RESEND_API_KEY || '').trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || process.env.ALERT_MAIL_FROM || 'PF積載 <noreply@paloma-pf.com>',
        to: [CONTACT_TO],
        subject: '【PF積載】ログイン画面からのお問い合わせ',
        text:
          `ログイン画面のお問い合わせフォームからメッセージが届きました。\n\n` +
          `名前: ${name || '（未入力）'}\n` +
          `社員番号: ${loginId || '（未入力）'}\n\n` +
          `内容:\n${message}\n\n` +
          `──\n送信元アプリ: PF積載 ${base}/login\n`,
        ...(process.env.MAIL_REPLY_TO?.trim() ? { reply_to: process.env.MAIL_REPLY_TO.trim() } : {}),
      }),
    });
    if (!res.ok) {
      const t = (await res.text().catch(() => '')).slice(0, 200);
      console.warn('[contact-admin] Resend error', res.status, t);
      return NextResponse.json(
        { error: '送信に失敗しました。時間をおいて再度お試しください。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact-admin] error:', err);
    return NextResponse.json(
      { error: '送信に失敗しました。時間をおいて再度お試しください。' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contact
 * 公開のお問い合わせフォーム(/contact)の送信を受け、inquiries に保存する。
 * 認証不要（公開フォーム）。最小限のバリデーションのみ。
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (v: unknown, max: number) => (v == null ? '' : String(v)).trim().slice(0, max);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const company = str(body.company, 200);
  const name = str(body.name, 200);
  const email = str(body.email, 200);
  const phone = str(body.phone, 50);
  const message = str(body.message, 5000);

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'required' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'email' }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO inquiries (company, name, email, phone, message)
      VALUES (${company || null}, ${name}, ${email}, ${phone || null}, ${message})
    `;

    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.CONTACT_FROM || 'スマコウバ積載 <onboarding@resend.dev>',
            to: [process.env.CONTACT_NOTIFY_TO || 'tyasuda83101028@gmail.com'],
            reply_to: email,
            subject: `【スマコウバ積載】お問い合わせ: ${company || name}`,
            text:
              `会社名: ${company || '(未記入)'}\n` +
              `お名前: ${name}\n` +
              `メール: ${email}\n` +
              `電話: ${phone || '(未記入)'}\n\n` +
              `--- お問い合わせ内容 ---\n${message}\n`,
          }),
        });
      } catch (e) {
        console.warn('[contact] email notify failed:', (e as Error).message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'failed', message: (e as Error).message }, { status: 500 });
  }
}

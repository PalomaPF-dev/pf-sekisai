import { NextRequest, NextResponse } from 'next/server';
import { createCompany, createUser, emailExists, seedDefaultsForCompany } from '@/lib/db';
import { withCors, preflight } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  return withCors(req, await handlePOST(req));
}

async function handlePOST(req: NextRequest) {
  try {
    const { companyName, userName, email, password } = await req.json();

    // バリデーション
    if (!companyName?.trim() || !userName?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ message: '全ての項目を入力してください。' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: 'パスワードは8文字以上にしてください。' }, { status: 400 });
    }

    // メール重複チェック
    const exists = await emailExists(email.toLowerCase().trim());
    if (exists) {
      return NextResponse.json({ message: 'このメールアドレスは既に登録されています。' }, { status: 409 });
    }

    // 会社 → ユーザー作成
    const companyId = await createCompany(companyName.trim());
    await createUser(companyId, email.toLowerCase().trim(), userName.trim(), password);

    // デフォルトデータ投入（パレット・トラックタイプのみ）
    await seedDefaultsForCompany(companyId);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[register] error:', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

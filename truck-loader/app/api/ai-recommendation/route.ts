import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { authOptions } from '@/lib/authOptions';
import { recommendationSchema } from '@/lib/aiSchema';
import { SYSTEM_PROMPT_JA, aiContextPayloadSchema } from '@/lib/aiContext';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Google Gemini（無料枠あり）。GOOGLE_GENERATIVE_AI_API_KEY を使用。
// 速度/コスト重視は 'gemini-2.0-flash'、より賢くしたい場合は 'gemini-2.5-flash' に変更可。
const AI_MODEL = google('gemini-2.0-flash');

export async function POST(req: NextRequest) {
  // 1. 認証ゲート（db.ts の getCompanyId と同じ判定）
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ message: '認証が必要です。' }, { status: 401 });
  }

  // 2. APIキー存在チェック（Google Gemini）
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { message: 'AI設定エラー: GOOGLE_GENERATIVE_AI_API_KEY が未設定です。.env.local に設定してください（無料キーは aistudio.google.com で取得）。' },
      { status: 503 },
    );
  }

  // 3. ペイロードの検証（クライアントが buildAiContext で生成した要約）
  let payload;
  try {
    const body = await req.json();
    payload = aiContextPayloadSchema.parse(body);
  } catch {
    return NextResponse.json({ message: 'リクエストの形式が不正です。' }, { status: 400 });
  }

  // 4. モデル呼び出し（構造化出力）
  try {
    const { output } = await generateText({
      model: AI_MODEL,
      output: Output.object({ schema: recommendationSchema }),
      system: SYSTEM_PROMPT_JA,
      prompt: `以下のデータを分析し、トラック選定・積載方法・送り数の見直し・警告を日本語で提案してください:\n${JSON.stringify(payload)}`,
      maxOutputTokens: 4000,
      temperature: 0.2,
    });

    return NextResponse.json({ recommendation: output }, { status: 200 });
  } catch (err: unknown) {
    console.error('[ai-recommendation] error:', err);
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 429) {
      return NextResponse.json(
        { message: 'AIが混雑しています。しばらくしてから再試行してください。' },
        { status: 429 },
      );
    }
    return NextResponse.json({ message: 'AI推奨の生成に失敗しました。' }, { status: 500 });
  }
}

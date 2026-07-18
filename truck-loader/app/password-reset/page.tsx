'use client';

import { useState } from 'react';
import Link from 'next/link';

/** パスワード再設定（メールアドレス入力 → 再設定リンクを送信）。 */
export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || '送信に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError('通信エラーが発生しました。');
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f7f5]">
      <div className="h-1 shrink-0 bg-[#9162f4]" />
      <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#e5e5e5] bg-white px-8 py-8">
          <div className="mb-6 flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl" />
            <p className="text-xs text-[#707070] tracking-wide">生産・調達統括本部</p>
            <h1 className="text-xl font-bold text-[#333333]">PF積載</h1>
            <p className="mt-1 text-xs text-[#707070]">パスワードの再設定</p>
          </div>

          {sent ? (
            <div className="text-sm text-gray-700 leading-relaxed space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">メールを送信しました</h2>
              <p>
                ご登録のメールアドレス宛てに、パスワード再設定用のリンクをお送りしました。
                メールに書かれたリンクを<strong>60分以内</strong>に開いて、新しいパスワードを設定してください。
              </p>
              <p className="text-gray-500">
                ※ メールが届かない場合は、迷惑メールフォルダをご確認のうえ、メールアドレスに間違いがないかもう一度お試しください。
              </p>
              <p className="pt-2">
                <Link href="/login" className="text-[#9162f4] hover:underline font-medium">
                  ログイン画面に戻る
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-[#333333] after:mt-2 after:block after:h-[3px] after:w-8 after:rounded-full after:bg-[#9162f4] after:content-['']">パスワードをお忘れの方</h2>
              <p className="mb-5 text-sm text-gray-500 leading-relaxed">
                ご登録のメールアドレスを入力して「送信」を押してください。
                パスワードを再設定するためのリンクをメールでお送りします。
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-1">メールアドレス</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                    placeholder="you@example.com"
                  />
                </div>
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#9162f4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7750c8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '送信中…' : '再設定用のメールを送信'}
                </button>
              </form>
              <p className="mt-5 text-center text-sm text-gray-500">
                <Link href="/login" className="text-[#9162f4] hover:underline font-medium">
                  ログイン画面に戻る
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

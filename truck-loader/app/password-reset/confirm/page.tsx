'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/** パスワード設定（招待リンク／再設定リンクから：新しいパスワードを入力して確定）。 */
export default function PasswordResetConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}

function ConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください。');
      return;
    }
    if (password !== password2) {
      setError('確認用のパスワードが一致しません。同じものを2回入力してください。');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || '変更に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }
      setDone(true);
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
            <p className="mt-1 text-xs text-[#707070]">新しいパスワードの設定</p>
          </div>

          {done ? (
            <div className="text-sm text-gray-700 leading-relaxed space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">パスワードを設定しました</h2>
              <p>新しいパスワードでログインしてください。</p>
              <Link
                href="/login"
                className="mt-2 block w-full rounded-lg bg-[#9162f4] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#7750c8] transition-colors"
              >
                ログイン画面へ
              </Link>
            </div>
          ) : !token ? (
            <div className="text-sm text-gray-700 leading-relaxed space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">リンクが正しくありません</h2>
              <p>
                メールに書かれたリンクをそのまま開いてください。リンクの有効期限が切れている場合は、
                お手数ですがもう一度最初からやり直してください。
              </p>
              <p className="pt-2">
                <Link href="/password-reset" className="text-[#9162f4] hover:underline font-medium">
                  再設定メールをもう一度送る
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-[#333333] after:mt-2 after:block after:h-[3px] after:w-8 after:rounded-full after:bg-[#9162f4] after:content-['']">新しいパスワードを入力</h2>
              <p className="mb-5 text-sm text-gray-500 leading-relaxed">
                新しいパスワード（8文字以上）を、確認のため2回入力してください。
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-1">新しいパスワード（8文字以上）</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-1">新しいパスワード（確認のためもう一度）</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                    placeholder="••••••••"
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
                  {loading ? '変更中…' : 'この内容でパスワードを設定'}
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

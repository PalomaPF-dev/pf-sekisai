'use client';

import { useState } from 'react';
import { signIn } from '@/lib/authClient';
import Link from 'next/link';

/**
 * 初回パスワード設定 — ポータル管理者が社員番号のみで発行したアカウント（pending）を
 * 本人がパスワード設定して有効化する画面。成功時はそのまま自動ログインする。
 */
export default function FirstLoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // パスワード設定は成功したが自動ログインに失敗した場合の案内
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください。');
      return;
    }
    if (password !== confirm) {
      setError('確認用のパスワードが一致しません。');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/first-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '設定に失敗しました。時間をおいて再度お試しください。');
        return;
      }

      // 設定完了 → そのまま自動ログイン（ログイン画面と同じ credentials 呼び出し）
      const result = await signIn('credentials', { email: loginId, password, redirect: false });
      if (result?.error) {
        setDone(true); // 設定自体は完了しているのでログイン画面へ誘導
        return;
      }
      try {
        localStorage.setItem('truckloader.dataSource', 'local');
        document.cookie = 'truckloader.demo=; path=/; max-age=0';
      } catch (err) { console.warn('dataSource モード保存に失敗:', err); }
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
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
            <p className="mt-1 text-xs text-[#707070]">出荷積載計画システム</p>
          </div>

          <h2 className="mb-2 text-lg font-semibold text-[#333333] after:mt-2 after:block after:h-[3px] after:w-8 after:rounded-full after:bg-[#9162f4] after:content-['']">初回パスワード設定</h2>
          <p className="mb-6 text-sm text-[#707070]">
            管理者から発行された社員番号で、はじめに使うパスワードを設定します。
          </p>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                パスワードを設定しました。ログイン画面から社員番号と設定したパスワードでログインしてください。
              </div>
              <Link
                href="/login"
                className="block w-full rounded-lg bg-[#9162f4] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#7750c8] transition-colors"
              >
                ログイン画面へ
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">社員番号</label>
              <input
                type="text"
                autoComplete="username"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                placeholder="例: 12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">新しいパスワード</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                placeholder="8文字以上"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                placeholder="もう一度入力"
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
              {loading ? '設定中...' : 'パスワードを設定してログイン'}
            </button>
          </form>
          )}

          <div className="mt-4 text-center text-sm">
            <Link href="/login" className="text-[#9162f4] hover:underline">
              ログイン画面へ戻る
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

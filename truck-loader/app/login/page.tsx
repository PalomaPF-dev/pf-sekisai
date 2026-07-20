'use client';

import { useEffect, useState } from 'react';
import { signIn } from '@/lib/authClient';
import Link from 'next/link';
import ContactAdminModal from '@/components/ContactAdminModal';

export default function LoginPage() {
  // credentials のフィールド名は互換のため email（中身は社員番号 or 従来のメールアドレス）
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 戻る操作などでページが復元されたとき、押していないのに「ログイン中…」のまま
  // 表示される状態バグを防ぐ（bfcache 復元時にローディング状態をリセット）
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLoading(false);
      }
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', { email: loginId, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      // authorize が明示的に throw したメッセージ（パスワード未設定など）はそのまま表示
      setError(
        result.error !== 'CredentialsSignin'
          ? result.error
          : '社員番号またはパスワードが正しくありません。'
      );
    } else {
      try {
        localStorage.setItem('truckloader.dataSource', 'local');
        document.cookie = 'truckloader.demo=; path=/; max-age=0';
      } catch (e) { console.warn('dataSource モード保存に失敗:', e); }
      window.location.href = '/';
    }
  }

  /** 「ログインせずにデモを見る」: デモモードを設定して即入る（社内紹介用）。 */
  function startDemo() {
    try {
      document.cookie = 'truckloader.demo=1; path=/; max-age=86400; samesite=lax';
      localStorage.setItem('truckloader.dataSource', 'local');
      localStorage.setItem('truckloader.autoSeedDemo', '1');
    } catch (e) { console.warn('デモ設定の保存に失敗:', e); }
    window.location.href = '/';
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

          <h2 className="mb-6 text-lg font-semibold text-[#333333] after:mt-2 after:block after:h-[3px] after:w-8 after:rounded-full after:bg-[#9162f4] after:content-['']">ログイン</h2>

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
                placeholder="例: 12345（管理者は admin）"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">パスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'ログイン中…' : 'ログイン'}
            </button>
          </form>

          {/* 社内紹介用: サンプルデータでワンクリック体験（実データには影響しない） */}
          <button
            type="button"
            onClick={startDemo}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 py-2.5 text-sm font-semibold text-[#555555] transition-colors hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            ログインせずにデモを見る
          </button>

          {/* ポータル一括ログイン（portal-first SSO） */}
          <div className="mt-4 rounded-lg border border-[#9162f4]/40 bg-[#f5f0fe] px-3 py-2.5 text-center text-sm">
            <a
              href="https://portal.paloma-pf.com/"
              className="font-semibold text-[#9162f4] hover:underline"
            >
              ポータルから一括ログイン
            </a>
          </div>
          <p className="mt-1 text-center text-xs text-[#707070]">
            ポータルでログインすると各アプリは自動でログインされます
          </p>

          <div className="mt-3 text-center text-sm">
            <Link href="/password-reset" className="text-[#9162f4] hover:underline">
              パスワードをお忘れの方はこちら
            </Link>
            <p className="mt-1 text-xs text-[#707070]">
              メール未登録の方は
              <ContactAdminModal />
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#707070]">
          拠点間の出荷配車・積載計画を見える化するクラウドツール
        </p>
        <div className="mt-3 text-center">
          <a
            href="https://portal.paloma-pf.com"
            className="text-sm text-[#707070] transition-colors hover:text-[#9162f4]"
          >
            ← ポータルへ戻る
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}

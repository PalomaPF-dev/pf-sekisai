'use client';

/**
 * クラウド同期ログイン（フェーズ4/6 残作業：ネイティブのトークン認証）。
 * メール/パスワードでトークンを取得し端末保存。ログインで同期(httpリモート)が有効になる。
 * 設定ページに配置。
 */
import { useEffect, useState } from 'react';
import { cloudLogin, cloudLogout, isCloudLoggedIn, deleteAccount } from '@/lib/auth/cloudAuth';
import { toast } from '@/components/Toast';

export function CloudSyncLogin() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isCloudLoggedIn().then(setLoggedIn).catch(() => setLoggedIn(false));
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { toast('メールとパスワードを入力してください', 'error'); return; }
    setBusy(true);
    const res = await cloudLogin(email.trim(), password);
    setBusy(false);
    if (res.ok) {
      setLoggedIn(true);
      setPassword('');
      toast(`✓ クラウド同期に接続しました${res.companyName ? '（' + res.companyName + '）' : ''}`, 'success');
    } else {
      toast(res.message ?? 'ログインに失敗しました', 'error');
    }
  };

  const handleLogout = async () => {
    await cloudLogout();
    setLoggedIn(false);
    toast('クラウド同期を切断しました（ローカル専用に戻ります）', 'info');
  };

  const handleDelete = async () => {
    if (!window.confirm('アカウントと、サーバー上の全データ（製品・在庫・計画など）を完全に削除します。\nこの操作は取り消せません。よろしいですか？')) return;
    setBusy(true);
    const res = await deleteAccount();
    setBusy(false);
    if (res.ok) {
      setLoggedIn(false);
      toast('アカウントとデータを削除しました', 'success');
    } else {
      toast(res.message ?? 'アカウント削除に失敗しました', 'error');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-bold text-gray-900">☁️ クラウド同期</h3>
      <p className="text-xs text-gray-500 mt-0.5">
        会社アカウントでログインすると、端末のデータがサーバーと同期され、複数端末で共有できます。
      </p>

      {loggedIn === null ? (
        <p className="text-xs text-gray-400 mt-3">確認中…</p>
      ) : loggedIn ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-green-700">✓ ログイン済み（同期有効）</span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ログアウト
            </button>
          </div>
          <div className="border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              アカウントとデータを削除する
            </button>
            <p className="text-[11px] text-gray-400 mt-0.5">アカウントとサーバー上の全データを完全に削除します（取り消せません）。</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:max-w-sm">
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleLogin}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? '接続中…' : 'ログインして同期を有効化'}
          </button>
        </div>
      )}
    </div>
  );
}

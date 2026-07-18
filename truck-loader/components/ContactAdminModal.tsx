"use client";

import { useState } from "react";

/**
 * ログイン画面の「管理者にお問い合わせください」導線。
 * mailto リンクはメールクライアントが無い端末で機能しないため、
 * モーダルのフォームからサーバー経由（/api/contact-admin）で管理者にメールを送る。
 * トリガーのボタンは従来のリンクと同じ見た目（文中に置ける下線テキスト）。
 */
export default function ContactAdminModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // ハニーポット（人間には見えない）
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  function openModal() {
    setDone(false);
    setError("");
    setUnavailable(false);
    setOpen(true);
  }

  function close() {
    if (sending) return;
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError("");
    setUnavailable(false);
    if (!message.trim()) {
      setError("お問い合わせ内容を入力してください");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/contact-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, loginId, message, website }),
      });
      if (res.ok) {
        setDone(true);
      } else if (res.status === 503) {
        setUnavailable(true);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "送信に失敗しました。時間をおいて再度お試しください。");
      }
    } catch {
      setError("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-[#707070] underline decoration-dotted underline-offset-2 transition-colors hover:text-[#9162f4] hover:decoration-solid"
      >
        管理者にお問い合わせください
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="管理者へのお問い合わせ"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-6 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[#333333]">管理者へのお問い合わせ</h3>

            {done ? (
              <>
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  送信しました。管理者からの連絡をお待ちください。
                </p>
                <div className="mt-5 text-right">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-[#d5d5d5] bg-white px-4 py-2 text-sm font-semibold text-[#555555] transition-colors hover:bg-[#f7f7f5]"
                  >
                    閉じる
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                <p className="text-xs text-[#707070]">
                  メール未登録などでログインできない場合は、こちらのフォームから管理者へご連絡ください。
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#333333]">
                    お名前（任意）
                  </label>
                  <input
                    type="text"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                    placeholder="例: 山田 太郎"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#333333]">
                    社員番号（任意）
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    maxLength={100}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                    placeholder="例: 12345"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#333333]">
                    お問い合わせ内容<span className="ml-1 text-red-600">（必須）</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    maxLength={2000}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full resize-y rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm focus:border-[#9162f4] focus:outline-none focus:ring-1 focus:ring-[#9162f4]"
                    placeholder="例: メールアドレスが未登録のためログインできません。登録をお願いします。"
                  />
                </div>
                {/* ハニーポット: bot 対策の不可視フィールド（人間は入力しない） */}
                <div className="hidden" aria-hidden="true">
                  <label>
                    Website
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>

                {unavailable && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    現在フォーム送信が利用できません。メールで{" "}
                    <span className="select-all font-semibold">info@paloma-pf.com</span>{" "}
                    までご連絡ください。
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    disabled={sending}
                    className="rounded-lg border border-[#d5d5d5] bg-white px-4 py-2 text-sm font-semibold text-[#555555] transition-colors hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    閉じる
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="rounded-lg bg-[#9162f4] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7750c8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? "送信中…" : "送信"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

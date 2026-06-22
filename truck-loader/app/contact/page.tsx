import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'お問い合わせ｜スマコウバ積載',
  description: 'スマコウバ積載のお問い合わせ。導入のご相談・お見積り・ご質問など。',
};

// App Store 申請の「サポートURL」用に未ログインで閲覧できる公開ページ（お問い合わせフォーム）。
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      {/* ロゴ・見出し */}
      <div className="text-center mb-8">
        <div
          className="mx-auto mb-3 flex items-center justify-center"
          style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1 0%,#3b82f6 50%,#06b6d4 100%)' }}
        >
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 34, lineHeight: 1, letterSpacing: -1 }}>ス</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">お問い合わせ</h1>
        <p className="mt-2 text-sm text-gray-500">
          導入のご相談・お見積り・ご質問など、お気軽にお問い合わせください。
        </p>
      </div>

      <ContactForm />

      <div className="mt-8 text-center text-xs text-gray-400 space-x-4">
        <a href="/pricing" className="text-blue-600 hover:underline">料金プラン</a>
        <a href="/terms" className="text-blue-600 hover:underline">利用規約</a>
        <a href="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</a>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">運営：スマコウバ運営事務局</p>
    </div>
  );
}

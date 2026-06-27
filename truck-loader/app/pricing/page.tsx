import type { Metadata } from 'next';
import NativeRedirect from '@/components/NativeRedirect';
import SubscribeButton from '@/components/SubscribeButton';

export const metadata: Metadata = {
  title: '料金｜スマコウバ積載',
  description: 'スマコウバ積載の料金プラン（法人向け・月額／年額）',
};

// 公開料金ページ（外部請求モデル）。
// ※ App Store ガイドライン3.1.1/3.1.3 のため、このページはアプリ内からはリンクしない（NativeRedirectでiOSは/loginへ）。
const FEATURES = [
  '複数拠点の積載計画',
  '荷台レイアウト図',
  'CSV入出力',
  'PDF出力（ドライバー配布）',
  'クラウド同期',
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-gray-800 leading-relaxed">
      {/* ネイティブ(iOS)では料金ページを表示しない（App Store 3.1.1：外部課金導線を出さない） */}
      <NativeRedirect to="/login" />
      <h1 className="text-2xl font-bold text-gray-900">料金プラン</h1>
      <p className="mt-1 text-sm text-gray-500">スマコウバ積載（トラック配車・積み付け計算）</p>

      <p className="mt-6">
        アプリは無料でダウンロードでき、基本機能はそのままご利用いただけます。
        現場で毎日使う <strong>Pro機能</strong> は、<strong>会社単位・人数無制限</strong>の法人プランでご提供します。
        まずは<strong>30日間の無料トライアル</strong>でお試しください（お試しにクレジットカードは不要）。
      </p>

      {/* 単一プラン：月額／年額の2択 */}
      <div className="mt-8 rounded-2xl border border-blue-600 ring-2 ring-blue-100 p-6">
        <div className="text-lg font-bold text-gray-900">法人プラン</div>
        <p className="mt-1 text-xs text-gray-500">会社単位・人数無制限</p>

        <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-2"><span className="text-blue-600">✓</span><span>{f}</span></li>
          ))}
        </ul>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {/* 月額 */}
          <div className="rounded-xl border border-gray-200 p-4 flex flex-col">
            <div className="text-sm font-bold text-gray-900">月額プラン</div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-gray-900">¥19,800</span>
              <span className="text-xs text-gray-500"> / 月（税別）</span>
            </div>
            <SubscribeButton plan="standard_monthly" label="月額でカード申し込み" className="mt-3 block w-full text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60" />
          </div>
          {/* 年額 */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex flex-col">
            <div className="text-sm font-bold text-gray-900">年額プラン <span className="ml-1 align-middle text-[10px] font-bold text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">2ヶ月分お得</span></div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-gray-900">¥198,000</span>
              <span className="text-xs text-gray-500"> / 年（税別）</span>
            </div>
            <SubscribeButton plan="standard_yearly" label="年額でカード申し込み" className="mt-3 block w-full text-center rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-60" />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-400 text-center">クレジットカード決済・いつでも解約可・30日間の無料トライアル</p>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        ※ 価格は税別。年額は月額の約10ヶ月分（2ヶ月分お得）。お支払いはクレジットカード決済。
      </p>

      {/* より大規模・カスタマイズのご相談 */}
      <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-6 text-center">
        <div className="text-base font-bold text-gray-900">より大規模・多拠点・カスタマイズのご相談</div>
        <p className="mt-1 text-sm text-gray-600">拠点数・ご利用人数が多い場合や個別要件は、お気軽にご相談ください。</p>
        <a
          href="mailto:sophie83101028@gmail.com?subject=スマコウバ積載 料金のお問い合わせ"
          className="inline-block mt-3 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
        >
          メールでお問い合わせ
        </a>
        <p className="mt-2 text-xs text-gray-500">スマコウバ運営事務局：sophie83101028@gmail.com</p>
      </div>

      <p className="mt-8 text-[11px] text-gray-400">
        <a href="/terms" className="underline hover:text-gray-600">利用規約</a>
        {' / '}
        <a href="/privacy" className="underline hover:text-gray-600">プライバシーポリシー</a>
        {' / '}
        <a href="/contact" className="underline hover:text-gray-600">お問い合わせ</a>
      </p>
    </div>
  );
}

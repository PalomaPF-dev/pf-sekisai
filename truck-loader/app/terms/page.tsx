import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約｜スマコウバ積載',
  description: 'スマコウバ積載の利用規約（EULA）・サブスクリプション条件',
};

// App Store のサブスク要件(GL 3.1.2)で必要な「利用規約(EULA)」公開ページ。
// 未ログインで閲覧できるよう middleware.ts の matcher から /terms を除外している。
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 text-gray-800 leading-relaxed">
      <h1 className="text-2xl font-bold text-gray-900">利用規約（EULA）</h1>
      <p className="mt-1 text-sm text-gray-500">スマコウバ積載（トラック配車・積み付け計算）</p>
      <p className="mt-1 text-sm text-gray-500">最終更新日：2026年6月20日</p>

      <p className="mt-6">
        本利用規約（以下「本規約」）は、スマコウバ運営事務局（以下「当方」）が提供するモバイルアプリ
        「スマコウバ積載」（以下「本アプリ」）の利用条件を定めるものです。利用者は本アプリを利用することで本規約に同意したものとみなされます。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">1. ライセンス</h2>
      <p className="mt-2">
        当方は利用者に対し、本規約に従って本アプリを利用する、譲渡不可・非独占的な権利を許諾します。
        本アプリの複製・改変・リバースエンジニアリング・再配布は禁止します。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">2. 料金プラン（無料／Pro）</h2>
      <ul className="mt-2 list-disc pl-6 space-y-1">
        <li>基本機能（生産・在庫の手入力、1拠点の積載計算・荷台レイアウト閲覧、基本ダッシュボード）は無料でご利用いただけます。</li>
        <li>Pro機能（複数拠点の積載計画、CSVインポート/エクスポート、PDF出力、クラウド同期、バーコード積込確認）は、月額または年額のサブスクリプション（会社単位・人数無制限）で提供します。</li>
      </ul>

      <h2 className="mt-8 text-lg font-bold text-gray-900">3. サブスクリプション（自動更新）</h2>
      <ul className="mt-2 list-disc pl-6 space-y-1">
        <li>料金・期間（月額／年額）・無料トライアルの有無は、購入時にアプリ内および App Store の購入画面に表示されます。</li>
        <li>お支払いは購入確定時に Apple ID アカウントへ請求されます。</li>
        <li>サブスクリプションは、現在の期間終了の24時間前までに自動更新をオフにしない限り自動的に更新され、更新料が請求されます。無料トライアル付きの場合、未使用分はトライアル開始時点で失効することがあります。</li>
        <li>購読の管理・自動更新の解除・解約は、購入後に「設定 → Apple ID → サブスクリプション」から行えます。</li>
      </ul>

      <h2 className="mt-8 text-lg font-bold text-gray-900">4. 返金</h2>
      <p className="mt-2">
        App Store 経由の購入に関する返金は Apple の規約・手続きに従います。返金の可否は Apple の判断によります。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">5. データの取扱い</h2>
      <p className="mt-2">
        個人情報・データの取扱いは
        <a className="text-blue-600 underline" href="/privacy">プライバシーポリシー</a>
        に従います。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">6. 免責</h2>
      <p className="mt-2">
        本アプリは現状有姿で提供されます。当方は、本アプリの算出結果（積載計画・必要台数など）の正確性・完全性・特定目的への適合性を保証しません。
        実際の配車・積載は利用者の責任で最終確認のうえ行ってください。当方は本アプリの利用により生じた損害について、法令で認められる範囲で責任を負いません。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">7. 規約の変更</h2>
      <p className="mt-2">本規約は必要に応じて改定します。重要な変更はアプリ内またはWebでお知らせします。</p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">8. Apple 標準EULA</h2>
      <p className="mt-2">
        本規約に定めのない事項については、Apple の
        <a className="text-blue-600 underline" href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener noreferrer">
          標準使用許諾契約（Licensed Application End User License Agreement）
        </a>
        が適用されます。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">9. お問い合わせ</h2>
      <p className="mt-2">
        スマコウバ運営事務局
        <br />
        メール：<a className="text-blue-600 underline" href="mailto:sophie83101028@gmail.com">sophie83101028@gmail.com</a>
      </p>

      <p className="mt-10 text-xs text-gray-400">© 2026 スマコウバ運営事務局</p>
    </div>
  );
}

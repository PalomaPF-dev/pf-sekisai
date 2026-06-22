import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'お問い合わせ｜スマコウバ積載',
  description: 'スマコウバ積載のお問い合わせ・サポート・よくある質問',
};

// App Store 申請の「サポートURL」用に未ログインで閲覧できる公開ページ。
// （middleware.ts の matcher で /contact を認証対象から除外している）
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 text-gray-800 leading-relaxed">
      <h1 className="text-2xl font-bold text-gray-900">お問い合わせ</h1>
      <p className="mt-1 text-sm text-gray-500">スマコウバ積載（トラック配車・積み付け計算）</p>

      <p className="mt-6">
        スマコウバ積載は、中小の製造業・物流現場向けの「トラック積載計画」アプリです。
        週間の生産数と拠点ごとの在庫から、どの拠点へ・どのトラックで・どう積むかを自動で算出し、
        荷台レイアウトや積込チェックリストとして可視化します。導入のご相談・ご質問など、下記の窓口までお気軽にお問い合わせください。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">お問い合わせ窓口</h2>
      <p className="mt-2">
        運営者：スマコウバ運営事務局
        <br />
        メール：<a className="text-blue-600 underline" href="mailto:sophie83101028@gmail.com">sophie83101028@gmail.com</a>
        <br />
        <span className="text-sm text-gray-500">通常2〜3営業日以内に返信いたします。</span>
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">よくある質問</h2>

      <h3 className="mt-5 font-bold text-gray-900">はじめ方を知りたい</h3>
      <p className="mt-1">
        起動後、ダッシュボードの「サンプルで始める」を押すとサンプルデータが入り、全体の流れを試せます。
        自社で使う場合は「初期設定ウィザード」から工場・拠点・製品などを登録してください。
      </p>

      <h3 className="mt-5 font-bold text-gray-900">オフラインでも使えますか？</h3>
      <p className="mt-1">
        はい。データは端末内に保存され、電波の弱い倉庫や車内でも表示・入力・再計算ができます。
        クラウド同期を有効にすると、複数端末でデータを共有できます。
      </p>

      <h3 className="mt-5 font-bold text-gray-900">料金について</h3>
      <p className="mt-1">
        アプリは無料でご利用いただけます。複数端末での本格運用やサポートを含む法人向けプランは、
        <a className="text-blue-600 underline" href="/pricing">料金ページ</a>または上記窓口へお問い合わせください。
      </p>

      <h3 className="mt-5 font-bold text-gray-900">バーコード読取で撮った画像は保存されますか？</h3>
      <p className="mt-1">
        いいえ。カメラはバーコード/QRの照合のみに使用し、画像は端末内で処理され、保存・送信されません。
      </p>

      <h3 className="mt-5 font-bold text-gray-900">アカウントとデータを削除したい</h3>
      <p className="mt-1">
        アプリ内「設定 → クラウド同期 → アカウントとデータを削除する」から、アカウントとサーバー上の
        全データを完全に削除できます。上記メール窓口でも対応します。
      </p>

      <h2 className="mt-8 text-lg font-bold text-gray-900">関連リンク</h2>
      <ul className="mt-2 list-disc pl-6 space-y-1">
        <li><a className="text-blue-600 underline" href="/privacy">プライバシーポリシー</a></li>
        <li><a className="text-blue-600 underline" href="/terms">利用規約</a></li>
        <li><a className="text-blue-600 underline" href="/pricing">料金</a></li>
      </ul>

      <p className="mt-10 text-xs text-gray-400">© 2026 スマコウバ運営事務局</p>
    </div>
  );
}

/** @type {import('next').NextConfig} */

// Capacitor（iOS）向けの静的書き出しビルドかどうか。
// CAPACITOR_BUILD=1 のときだけ output:'export'（out/ に静的HTML出力）に切り替える。
// 通常の Vercel ビルドには一切影響しない。
//
// ※ Server Actions（lib/db.ts）は静的書き出し不可。build-capacitor.mjs が
//    ビルド中だけ lib/db.ts をスタブへ物理差し替えするため、型チェックは
//    通常ビルド側に任せてここでは無効化する。
// ※ 認証（next-auth/react）のオフライン切替は lib/authClient.tsx で
//    NEXT_PUBLIC_CAPACITOR により実行時に分岐（webpackエイリアスは不安定なため不使用）。
const isCapacitor = process.env.CAPACITOR_BUILD === '1';

const nextConfig = isCapacitor
  ? {
      output: 'export',
      images: { unoptimized: true },
      typescript: { ignoreBuildErrors: true },
      eslint: { ignoreDuringBuilds: true },
    }
  : {};

export default nextConfig;

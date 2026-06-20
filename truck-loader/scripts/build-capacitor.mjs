#!/usr/bin/env node
/**
 * Capacitor（iOS）向け静的ビルドスクリプト。
 *
 * Next.js の `output: 'export'` は API Routes / middleware を静的化できない。
 * これらは Vercel サーバー専用で、ネイティブアプリには不要なので、ビルド中だけ
 * 一時退避してから `next build`（CAPACITOR_BUILD=1）を実行し、生成された out/ を
 * www/ にコピーする。退避ファイルは finally で必ず元に戻す。
 *
 * 実行: npm run build:ios
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, renameSync, mkdirSync, cpSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, '.capacitor-build-tmp');

// 退避対象（API/middleware は静的書き出し不可）: [元のパス, 退避先のパス]
const moves = [
  [join(root, 'app', 'api'), join(tmp, 'api')],
  [join(root, 'middleware.ts'), join(tmp, 'middleware.ts')],
];

// Server Actions（lib/db.ts）はスタブへ物理差し替え
const dbReal = join(root, 'lib', 'db.ts');
const dbStub = join(root, 'lib', 'db.capacitor-stub.ts');
const dbBackup = join(tmp, 'db.real.ts');

function stash() {
  if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
  for (const [from, to] of moves) {
    if (existsSync(from)) {
      console.log(`[stash] ${from} → ${to}`);
      renameSync(from, to);
    }
  }
  // lib/db.ts を退避し、スタブで置き換える
  if (existsSync(dbReal)) {
    console.log('[stash] lib/db.ts → スタブに差し替え');
    renameSync(dbReal, dbBackup);
    copyFileSync(dbStub, dbReal);
  }
}

function restore() {
  // lib/db.ts を元に戻す（スタブのコピーを削除して実体を復元）
  if (existsSync(dbBackup)) {
    console.log('[restore] lib/db.ts を実体に復元');
    rmSync(dbReal, { force: true });
    renameSync(dbBackup, dbReal);
  }
  for (const [from, to] of moves) {
    if (existsSync(to)) {
      console.log(`[restore] ${to} → ${from}`);
      renameSync(to, from);
    }
  }
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
}

try {
  stash();

  console.log('[build] next build (output: export, local data source)...');
  execSync('next build', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CAPACITOR_BUILD: '1', NEXT_PUBLIC_CAPACITOR: '1' },
  });

  const out = join(root, 'out');
  const www = join(root, 'www');
  if (!existsSync(out)) throw new Error('out/ が生成されませんでした');

  console.log('[copy] out/ → www/');
  rmSync(www, { recursive: true, force: true });
  cpSync(out, www, { recursive: true });

  console.log('\n✅ Capacitor 用の静的フロントを www/ に出力しました。');
  console.log('   次: npm run cap:sync（要 Xcode/CocoaPods）でネイティブに反映。');
} finally {
  restore();
}

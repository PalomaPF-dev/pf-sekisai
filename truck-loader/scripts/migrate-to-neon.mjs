#!/usr/bin/env node
/**
 * migrate-to-neon.mjs
 *
 * Neon にスキーマを作成し、Supabase から生成した seed データを投入する。
 * @neondatabase/serverless の HTTP ドライバーを使用。
 *
 * 使い方:
 *   node scripts/migrate-to-neon.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dir, '..');

// .env.local から DATABASE_URL を読み込む
function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.includes('user:password@xxx')) {
  console.error('❌ DATABASE_URL が設定されていません。');
  process.exit(1);
}

// direct 接続（移行時はpoolerより安定）
const directUrl = DATABASE_URL.replace('-pooler.', '.');
const masked = directUrl.replace(/:\/\/[^@]+@/, '://***@');
console.log(`📦 接続先: ${masked}`);

const sql = neon(directUrl);

// SQLファイルをセミコロンで分割
function splitStatements(sqlText) {
  return sqlText
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// リトライ付き個別実行
async function execWithRetry(stmt, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // neon tagged template でそのまま実行できないため sql.query を使用
      await sql.query(stmt);
      return;
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      const isRetryable = msg.includes('fetch failed') || msg.includes('econnreset')
        || msg.includes('timeout') || msg.includes('connect');
      if (isRetryable && i < maxRetries - 1) {
        const delay = 1000 * (i + 1);
        process.stdout.write(`\n  ⚠️ 接続エラー(${i+1}/${maxRetries})、${delay/1000}s 後にリトライ...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

async function runFile(label, filePath) {
  console.log(`\n${label}`);
  const fullPath = join(projectRoot, filePath);
  if (!existsSync(fullPath)) {
    console.error(`  ❌ ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }
  const content = readFileSync(fullPath, 'utf-8');
  const statements = splitStatements(content);
  console.log(`  ${statements.length} ステートメントを実行中...`);

  let done = 0;
  for (const stmt of statements) {
    try {
      await execWithRetry(stmt);
    } catch (err) {
      console.error(`\n  ❌ エラー: ${err.message}`);
      console.error(`  SQL: ${stmt.slice(0, 120)}`);
      process.exit(1);
    }
    done++;
    if (done % 50 === 0 || done === statements.length) {
      process.stdout.write(`  ${done}/${statements.length}...\r`);
    }
    // 50件ごとに少し待機（rate limit 対策）
    if (done % 200 === 0) await sleep(500);
  }
  console.log(`  ✅ ${done} ステートメント完了             `);
}

async function checkCounts() {
  console.log('\n3️⃣  件数確認...');
  const tables = [
    'factories', 'products', 'warehouses', 'truck_types', 'pallet_types',
    'production_plan', 'distribution_ratios', 'inventory_stock',
    'location_stock', 'in_transit_stock', 'planned_sales',
    'weekly_shipping_schedule',
  ];
  for (const t of tables) {
    try {
      const rows = await sql.query(`SELECT COUNT(*) as count FROM ${t}`);
      const count = rows[0]?.count ?? '?';
      console.log(`  ${t.padEnd(28)} ${count} 件`);
    } catch (err) {
      console.log(`  ${t.padEnd(28)} エラー: ${err.message}`);
    }
  }
}

(async () => {
  try {
    await runFile('1️⃣  スキーマ作成中...', 'neon-schema.sql');
    await runFile('2️⃣  データ投入中...', 'neon-seed-data.sql');
    await checkCounts();
    console.log('\n🎉 Neon への移行が完了しました！');
    console.log('\n次のステップ:');
    console.log('  npm run dev  →  動作確認');
    console.log('  vercel env add DATABASE_URL  →  Vercel に DATABASE_URL を登録');
  } catch (err) {
    console.error('\n❌ 移行中にエラーが発生しました:', err.message);
    process.exit(1);
  }
})();

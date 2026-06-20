// 指定SQLファイルを本番Neonに対して実行する。.env.local から DATABASE_URL を読む（値は出力しない）。
// 使い方: node scripts/run-sql.mjs migrations/0003_subscription.sql
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// .env.local を手動ロード（秘密値は表示しない）
function loadEnvLocal() {
  try {
    const txt = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* なければ環境変数を使う */ }
}
loadEnvLocal();

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/run-sql.mjs <file.sql>'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sqlText = readFileSync(join(root, file), 'utf8');
const sql = neon(process.env.DATABASE_URL);

// 文（セミコロン区切り）を順に実行。コメント行は除去。
const statements = sqlText
  .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  .split(';').map((s) => s.trim()).filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
  console.log('OK:', stmt.slice(0, 70).replace(/\s+/g, ' '));
}
console.log('DONE', file);

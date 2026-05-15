import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL が設定されていません。環境変数に追加してください。');
}

export const sql = neon(process.env.DATABASE_URL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_add_product_fields.sql
--
-- products テーブルに後発のカラムを追加する。
--
-- 実行方法：
--   Supabase Dashboard → SQL Editor を開いてこの内容をコピペし「Run」。
--   IF NOT EXISTS 付きなので、既に追加済みの環境でも安全に再実行できる。
-- ─────────────────────────────────────────────────────────────────────────────

-- フェーズ1（器具情報・ポジ・仕向け・生産方式）
ALTER TABLE products ADD COLUMN IF NOT EXISTS equipment_category text    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS equipment_name     text    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS poji               boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS destination        text    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_method  text    DEFAULT '';

-- フェーズ2（2段積み条件）
ALTER TABLE products ADD COLUMN IF NOT EXISTS stackable          boolean DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_stack_on_top boolean DEFAULT true;

-- 確認用クエリ（実行は任意）：
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'products'
-- ORDER BY ordinal_position;

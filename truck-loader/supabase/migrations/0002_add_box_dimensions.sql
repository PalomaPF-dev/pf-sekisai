-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_add_box_dimensions.sql
--
-- products テーブルに段ボール寸法カラムを追加する（積付計算機能用）。
--
-- 実行方法：
--   Supabase Dashboard → SQL Editor を開いてこの内容をコピペし「Run」。
--   IF NOT EXISTS 付きなので、既に追加済みの環境でも安全に再実行できる。
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS box_width_mm  integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_depth_mm  integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_height_mm integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_weight_kg numeric(6,2);

-- 確認用クエリ（実行は任意）：
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' AND column_name LIKE 'box_%';

-- ─────────────────────────────────────────────────────────────────────────────
-- neon-schema.sql
--
-- Neon PostgreSQL スキーマ定義（全テーブル）
-- Neon Dashboard → SQL Editor または psql で実行してください。
-- IF NOT EXISTS 付きなので、既存環境でも安全に再実行できます。
-- ─────────────────────────────────────────────────────────────────────────────

-- 工場マスタ
CREATE TABLE IF NOT EXISTS factories (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 製品マスタ
CREATE TABLE IF NOT EXISTS products (
  code                TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  capacity_per_pallet INTEGER NOT NULL,
  pallet_type         TEXT NOT NULL,
  color               TEXT NOT NULL,
  factory_code        TEXT NOT NULL DEFAULT 'F001',
  equipment_category  TEXT NOT NULL DEFAULT '',
  equipment_name      TEXT NOT NULL DEFAULT '',
  poji                BOOLEAN NOT NULL DEFAULT false,
  destination         TEXT NOT NULL DEFAULT '',
  production_method   TEXT NOT NULL DEFAULT '',
  stackable           BOOLEAN NOT NULL DEFAULT true,
  allow_stack_on_top  BOOLEAN NOT NULL DEFAULT true,
  box_width_mm        INTEGER,
  box_depth_mm        INTEGER,
  box_height_mm       INTEGER,
  box_weight_kg       NUMERIC(6,2)
);

-- 拠点（倉庫）マスタ
CREATE TABLE IF NOT EXISTS warehouses (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  "group"     TEXT NOT NULL,
  truck_type  TEXT NOT NULL,
  max_pallets INTEGER NOT NULL
);

-- トラック種別マスタ
CREATE TABLE IF NOT EXISTS truck_types (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  max_pallets INTEGER NOT NULL,
  cols        INTEGER NOT NULL,
  rows        INTEGER NOT NULL,
  width_mm    INTEGER NOT NULL,
  depth_mm    INTEGER NOT NULL,
  height_mm   INTEGER NOT NULL DEFAULT 2300
);

-- パレット種別マスタ
CREATE TABLE IF NOT EXISTS pallet_types (
  code             TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  width_mm         INTEGER NOT NULL,
  depth_mm         INTEGER NOT NULL,
  height_mm        INTEGER NOT NULL,
  max_weight_kg    NUMERIC(6,2) NOT NULL,
  loaded_height_mm INTEGER NOT NULL DEFAULT 1200
);

-- 週間生産計画（製品コード → 合計個数）
CREATE TABLE IF NOT EXISTS production_plan (
  product_code TEXT PRIMARY KEY,
  qty          INTEGER NOT NULL DEFAULT 0
);

-- 日別生産計画（製品コード × 日付 → 個数）
CREATE TABLE IF NOT EXISTS daily_production_plan (
  product_code TEXT NOT NULL,
  date         TEXT NOT NULL,
  qty          INTEGER NOT NULL,
  PRIMARY KEY (product_code, date)
);

-- 配分比率（製品コード × 拠点コード → 比率%）
CREATE TABLE IF NOT EXISTS distribution_ratios (
  product_code   TEXT NOT NULL,
  warehouse_code TEXT NOT NULL,
  ratio          NUMERIC(6,2) NOT NULL,
  PRIMARY KEY (product_code, warehouse_code)
);

-- 全体在庫数（製品コード → 個数）
CREATE TABLE IF NOT EXISTS inventory_stock (
  product_code TEXT PRIMARY KEY,
  qty          INTEGER NOT NULL DEFAULT 0
);

-- 拠点別現在庫（製品コード × 拠点コード → 個数）
CREATE TABLE IF NOT EXISTS location_stock (
  product_code   TEXT NOT NULL,
  warehouse_code TEXT NOT NULL,
  qty            INTEGER NOT NULL,
  PRIMARY KEY (product_code, warehouse_code)
);

-- 輸送中在庫（製品コード × 拠点コード → 個数）
CREATE TABLE IF NOT EXISTS in_transit_stock (
  product_code   TEXT NOT NULL,
  warehouse_code TEXT NOT NULL,
  qty            INTEGER NOT NULL,
  PRIMARY KEY (product_code, warehouse_code)
);

-- 計画販売数（製品コード × 拠点コード → 個数）
CREATE TABLE IF NOT EXISTS planned_sales (
  product_code   TEXT NOT NULL,
  warehouse_code TEXT NOT NULL,
  qty            INTEGER NOT NULL,
  PRIMARY KEY (product_code, warehouse_code)
);

-- 週間出荷スケジュール（工場コード × 拠点コード → 曜日配列）
CREATE TABLE IF NOT EXISTS weekly_shipping_schedule (
  factory_code   TEXT NOT NULL,
  warehouse_code TEXT NOT NULL,
  days           BOOLEAN[] NOT NULL,
  PRIMARY KEY (factory_code, warehouse_code)
);

-- 稼働日マスタ（工場コード → 曜日配列）
CREATE TABLE IF NOT EXISTS operating_days (
  factory_code TEXT PRIMARY KEY,
  days         BOOLEAN[] NOT NULL
);

-- 非稼働日（祝日・特別休業日）（工場コード × 日付）
CREATE TABLE IF NOT EXISTS non_working_dates (
  factory_code TEXT NOT NULL,
  date         TEXT NOT NULL,
  PRIMARY KEY (factory_code, date)
);

-- 送り数手動上書き（製品コード × 拠点コード → 個数）
CREATE TABLE IF NOT EXISTS send_qty_manual (
  product_code   TEXT NOT NULL,
  warehouse_code TEXT NOT NULL,
  qty            INTEGER NOT NULL,
  PRIMARY KEY (product_code, warehouse_code)
);

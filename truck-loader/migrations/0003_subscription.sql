-- サブスク(RevenueCat)状態を companies に保持する。
-- 会社単位のエンタイトルメント。RevenueCat Webhook で更新し、Web/iOS 双方が参照する。
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_plan TEXT;              -- 'monthly' | 'annual' | null
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_store TEXT;             -- 'app_store' | 'play_store' | etc
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_product_id TEXT;        -- RevenueCat product identifier
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ; -- 失効/更新期限
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ; -- 最終更新

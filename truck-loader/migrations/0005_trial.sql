-- 会社単位の無料トライアル（30日）。期限内 or is_pro(契約済) で利用可。
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 既存会社にトライアル期限を付与（未設定のものは作成日+30日）。
UPDATE companies
   SET trial_ends_at = created_at + INTERVAL '30 days'
 WHERE trial_ends_at IS NULL;

-- 審査用デモ会社「テスト物流」は is_pro=true 済み（常に利用可）。確実化のため期限も十分先に。
UPDATE companies
   SET trial_ends_at = NOW() + INTERVAL '3650 days'
 WHERE id = '4a231a88-302b-4def-afd5-c086f0448ab7';

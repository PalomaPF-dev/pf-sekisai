-- お問い合わせフォーム(/contact)の送信内容を保存する。
CREATE TABLE IF NOT EXISTS inquiries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company    TEXT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

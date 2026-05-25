/*
  # Create all tables: pins, uploads, coin_txns, users, reports, coupons

  Creates all application tables from scratch with RLS policies.

  1. Tables
    - `pins` — map requests with place/question/reward
    - `uploads` — photo submissions against pins
    - `coin_txns` — coin ledger for each user
    - `users` — app profile (mirrors auth.users), includes is_admin flag
    - `reports` — abuse reports on pins/uploads
    - `coupons` — issued dunkin/store coupons

  2. Security
    - RLS enabled on all tables
    - Authenticated users can read/insert/update their own rows
    - pins: all authenticated users can read; admins insert via service role or with null user_id policy
*/

-- ── pins ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pin_type      text NOT NULL DEFAULT 'existing',
  is_admin_pin  boolean NOT NULL DEFAULT false,
  place_name    text NOT NULL DEFAULT '',
  question      text NOT NULL DEFAULT '',
  lat           float8 NOT NULL DEFAULT 37.5588,
  lng           float8 NOT NULL DEFAULT 126.8374,
  status        text NOT NULL DEFAULT 'open',
  urgency       text NOT NULL DEFAULT 'normal',
  reward_coin   int NOT NULL DEFAULT 50,
  curious_count int NOT NULL DEFAULT 0,
  report_count  int NOT NULL DEFAULT 0,
  hidden        boolean NOT NULL DEFAULT false,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view pins"
  ON pins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own pins"
  ON pins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own pins"
  ON pins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pins"
  ON pins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── uploads ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uploads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id       uuid REFERENCES pins(id) ON DELETE SET NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_url    text NOT NULL DEFAULT '',
  gps_lat      float8,
  gps_lng      float8,
  gps_accuracy float8,
  captured_at  timestamptz,
  submitted_at timestamptz DEFAULT now(),
  device_os    text DEFAULT '',
  report_count int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own uploads"
  ON uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can view uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (true);

-- ── coin_txns ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_txns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type       text NOT NULL DEFAULT 'earn',
  amount     int  NOT NULL DEFAULT 0,
  reason     text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'paid',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '90 days'
);

ALTER TABLE coin_txns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own coin_txns"
  ON coin_txns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own coin_txns"
  ON coin_txns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kakao_id     text DEFAULT '',
  nickname     text DEFAULT '',
  email        text DEFAULT '',
  profile_img  text DEFAULT '',
  is_admin     boolean NOT NULL DEFAULT false,
  flagged      boolean NOT NULL DEFAULT false,
  flag_reasons text[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── reports ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id   uuid NOT NULL,
  target_type text NOT NULL DEFAULT 'pin',
  reason      text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can submit reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- ── coupons ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_type text NOT NULL DEFAULT 'dunkin_1plus1',
  qr_code     text NOT NULL DEFAULT gen_random_uuid()::text,
  status      text NOT NULL DEFAULT 'active',
  issued_at   timestamptz DEFAULT now(),
  expires_at  timestamptz,
  redeemed_at timestamptz,
  store_name  text DEFAULT ''
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own coupons"
  ON coupons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own coupons"
  ON coupons FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

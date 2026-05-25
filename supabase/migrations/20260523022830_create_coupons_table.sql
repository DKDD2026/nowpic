/*
  # Create coupons table

  1. New Tables
    - `coupons`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users)
      - `coupon_type` (text) — 'dunkin_1plus1' | 'dunkin_donut' | 'starbucks_coffee'
      - `qr_code` (text) — unique code shown to store staff (gen_random_uuid())
      - `status` (text, default 'active') — 'active' | 'used' | 'expired'
      - `issued_at` (timestamptz, default now())
      - `expires_at` (timestamptz) — today midnight KST
      - `redeemed_at` (timestamptz)
      - `store_name` (text)

  2. Security
    - RLS enabled
    - Users can insert their own coupons
    - Users can read their own coupons
    - Users can update their own coupons (to mark used)
*/

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

/*
  # Create pins table

  1. New Tables
    - `pins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable — admin pins may have no user)
      - `pin_type` (text) — 'admin' | 'existing' | 'temporary'
      - `is_admin_pin` (boolean, default false)
      - `place_name` (text)
      - `question` (text)
      - `lat` (float8)
      - `lng` (float8)
      - `status` (text, default 'open') — 'open' | 'completed' | 'expired'
      - `urgency` (text, default 'normal') — 'normal' | 'hot' | 'urgent'
      - `reward_coin` (int, default 50)
      - `curious_count` (int, default 0)
      - `expires_at` (timestamptz, nullable)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS
    - Authenticated users can read all open/completed pins
    - Authenticated users can insert their own pins
    - Authenticated users can update their own pins
    - Authenticated users can delete their own pins

  3. Notes
    - Temporary pins (pin_type = 'temporary') set expires_at = now() + 30 minutes on insert
    - Admin pins are inserted manually or via service role
*/

CREATE TABLE IF NOT EXISTS pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pin_type text NOT NULL DEFAULT 'existing',
  is_admin_pin boolean NOT NULL DEFAULT false,
  place_name text NOT NULL DEFAULT '',
  question text NOT NULL DEFAULT '',
  lat float8 NOT NULL DEFAULT 37.5588,
  lng float8 NOT NULL DEFAULT 126.8374,
  status text NOT NULL DEFAULT 'open',
  urgency text NOT NULL DEFAULT 'normal',
  reward_coin int NOT NULL DEFAULT 50,
  curious_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view pins"
  ON pins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own pins"
  ON pins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pins"
  ON pins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pins"
  ON pins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Seed two admin demo pins for 마곡 area
INSERT INTO pins (user_id, pin_type, is_admin_pin, place_name, question, lat, lng, status, urgency, reward_coin)
VALUES
  (NULL, 'admin', true, '마곡역 스타벅스', '자리 여유 궁금!', 37.5608, 126.8374, 'open', 'hot', 100),
  (NULL, 'admin', true, '던킨도너츠', '마감세일 중?', 37.5568, 126.8394, 'open', 'normal', 80);

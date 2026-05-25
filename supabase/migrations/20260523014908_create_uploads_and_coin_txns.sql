/*
  # Create uploads and coin_txns tables

  1. New Tables

    - `uploads`
      - `id` (uuid, primary key)
      - `pin_id` (uuid, FK to pins)
      - `user_id` (uuid, FK to auth.users)
      - `photo_url` (text) — public storage URL
      - `gps_lat` (float8) — captured GPS latitude
      - `gps_lng` (float8) — captured GPS longitude
      - `gps_accuracy` (float8) — accuracy in metres
      - `captured_at` (timestamptz) — when the photo was taken
      - `submitted_at` (timestamptz, default now())
      - `device_os` (text) — user agent / platform string
      - `created_at` (timestamptz, default now())

    - `coin_txns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `type` (text) — 'earn' | 'spend' | 'refund'
      - `amount` (int)
      - `reason` (text)
      - `status` (text, default 'paid') — 'pending' | 'paid' | 'expired'
      - `created_at` (timestamptz, default now())
      - `expires_at` (timestamptz, default now() + 90 days)

  2. Security
    - Enable RLS on both tables
    - uploads: authenticated users can insert own rows; read own rows
    - coin_txns: authenticated users can insert own rows; read own rows

  3. Notes
    - Storage bucket 'pin-photos' must be created separately (public bucket)
    - coin_txns.expires_at defaults to 90 days from creation
*/

-- ── uploads ─────────────────────────────────────────────────────────────────

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

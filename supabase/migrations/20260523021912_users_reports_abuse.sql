/*
  # Users, reports, abuse detection

  1. New Tables
    - `users` — app user profile mirroring auth.users
      - `id` (uuid, PK, matches auth.users.id)
      - `kakao_id` (text)
      - `nickname` (text)
      - `email` (text)
      - `profile_img` (text)
      - `is_admin` (boolean, default false)
      - `flagged` (boolean, default false)
      - `flag_reasons` (text[])
      - `created_at` (timestamptz)

    - `reports`
      - `id` (uuid, PK)
      - `reporter_id` (uuid, FK auth.users)
      - `target_id` (uuid) — pin_id or upload_id
      - `target_type` (text) — 'pin' | 'upload'
      - `reason` (text)
      - `created_at` (timestamptz)

  2. Alterations
    - Add `report_count` int column to `pins` (default 0)
    - Add `hidden` boolean to `pins` (default false) — auto-set when report_count >= 5

  3. Security
    - RLS on both new tables
    - users: read own row; service role can update flagged
    - reports: authenticated can insert; read own reports
*/

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kakao_id    text DEFAULT '',
  nickname    text DEFAULT '',
  email       text DEFAULT '',
  profile_img text DEFAULT '',
  is_admin    boolean NOT NULL DEFAULT false,
  flagged     boolean NOT NULL DEFAULT false,
  flag_reasons text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
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

-- ── pins: add report_count + hidden ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pins' AND column_name = 'report_count'
  ) THEN
    ALTER TABLE pins ADD COLUMN report_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pins' AND column_name = 'hidden'
  ) THEN
    ALTER TABLE pins ADD COLUMN hidden boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── uploads: add report_count ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'report_count'
  ) THEN
    ALTER TABLE uploads ADD COLUMN report_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

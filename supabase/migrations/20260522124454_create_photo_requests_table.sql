/*
  # Create photo_requests table

  1. New Tables
    - `photo_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `place` (text) — location name
      - `status` (text) — '진행 중' | '응답 완료'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can read all requests (for stats/explore)
    - Users can insert their own requests
    - Users can update/delete their own requests
*/

CREATE TABLE IF NOT EXISTS photo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '진행 중',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE photo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all requests"
  ON photo_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own requests"
  ON photo_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own requests"
  ON photo_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own requests"
  ON photo_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

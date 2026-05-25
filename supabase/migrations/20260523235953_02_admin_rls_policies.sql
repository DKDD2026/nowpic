/*
  # Admin RLS policies

  Adds SELECT policies so admin users (is_admin=true in users table) can
  read all rows across pins, uploads, coin_txns, coupons, reports, users.

  Also adds UPDATE policy on users so admins can flag/unflag accounts.

  1. Policies Added
    - pins: admin can read all
    - uploads: admin can read all (already exists but deduplicated)
    - coin_txns: admin can read all
    - coupons: admin can read all + update all
    - users: admin can read all + update all
    - reports: admin can read all
*/

-- Helper: inline admin check using a subquery on users table
-- (avoids needing a custom function)

-- ── pins: admin can read all ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pins' AND policyname = 'Admin can read all pins'
  ) THEN
    CREATE POLICY "Admin can read all pins"
      ON pins FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

-- ── coin_txns: admin can read all ───────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coin_txns' AND policyname = 'Admin can read all coin_txns'
  ) THEN
    CREATE POLICY "Admin can read all coin_txns"
      ON coin_txns FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

-- ── coupons: admin can read all ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Admin can read all coupons'
  ) THEN
    CREATE POLICY "Admin can read all coupons"
      ON coupons FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Admin can update all coupons'
  ) THEN
    CREATE POLICY "Admin can update all coupons"
      ON coupons FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

-- ── users: admin can read all ────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Admin can read all users'
  ) THEN
    CREATE POLICY "Admin can read all users"
      ON users FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u2
          WHERE u2.id = auth.uid() AND u2.is_admin = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Admin can update all users'
  ) THEN
    CREATE POLICY "Admin can update all users"
      ON users FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u2
          WHERE u2.id = auth.uid() AND u2.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users u2
          WHERE u2.id = auth.uid() AND u2.is_admin = true
        )
      );
  END IF;
END $$;

-- ── reports: admin can read all ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Admin can read all reports'
  ) THEN
    CREATE POLICY "Admin can read all reports"
      ON reports FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

-- ── uploads: admin can read all (idempotent) ─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'uploads' AND policyname = 'Admin can read all uploads'
  ) THEN
    CREATE POLICY "Admin can read all uploads"
      ON uploads FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

-- ── pins: admin can update/delete all ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pins' AND policyname = 'Admin can update all pins'
  ) THEN
    CREATE POLICY "Admin can update all pins"
      ON pins FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pins' AND policyname = 'Admin can delete all pins'
  ) THEN
    CREATE POLICY "Admin can delete all pins"
      ON pins FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.is_admin = true
        )
      );
  END IF;
END $$;

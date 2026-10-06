-- backend/tests/test_schema.sql
-- Verification queries for Task 2 (task brief Step 4) + structural checks.
--
-- Usage:  psql "$SUPABASE_DB_URL" -f backend/tests/test_schema.sql
-- Pre-req: migrations 0001_initial_schema.sql, 0002_rls_policies.sql,
--          0003_wallet_identity.sql and 0004_pivot_removals.sql applied.
-- Target: Supabase (0002 references auth.uid(), not present on vanilla Postgres).
-- A failed assertion raises an exception; with ON_ERROR_STOP the run aborts.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- 1. RLS enabled on ALL public tables (brief Step 4)
--    Expected: 6 rows, every rowsecurity = true
-- ---------------------------------------------------------------------
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

DO $$
BEGIN
    IF (SELECT count(*) FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = false) > 0 THEN
        RAISE EXCEPTION 'RLS not enabled on: %',
            (SELECT string_agg(tablename, ', ')
             FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false);
    END IF;
    IF (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') <> 6 THEN
        RAISE EXCEPTION 'Expected 6 public tables, found %',
            (SELECT count(*) FROM pg_tables WHERE schemaname = 'public');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Expected tables exist
-- ---------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ---------------------------------------------------------------------
-- 3. Pivot removals (migration 0004): channels.pin_hash must NOT exist,
--    anonymous_links.wallet_address must NOT exist,
--    encrypted_phones table is gone
-- ---------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'channels' AND column_name = 'pin_hash')
    OR (table_name = 'anonymous_links' AND column_name = 'wallet_address'))
ORDER BY table_name, column_name;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'channels' AND column_name = 'pin_hash') THEN
        RAISE EXCEPTION 'channels.pin_hash must be dropped (migration 0004)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'anonymous_links' AND column_name = 'wallet_address') THEN
        RAISE EXCEPTION 'anonymous_links.wallet_address must be dropped (migration 0004)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'encrypted_phones') THEN
        RAISE EXCEPTION 'encrypted_phones must be dropped (migration 0004)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. anonymous_links columns exactly as ruled after 0004:
--    id, channel_id, fan_id, status, subscribed_at, opted_out_at
-- ---------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'anonymous_links'
ORDER BY ordinal_position;

DO $$
BEGIN
    IF (SELECT array_agg(column_name ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'anonymous_links')
       <> ARRAY['id', 'channel_id', 'fan_id', 'status', 'subscribed_at', 'opted_out_at']::text[] THEN
        RAISE EXCEPTION 'anonymous_links column set mismatch: %',
            (SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'anonymous_links');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. Unique constraints on anonymous_links
--    Expected: exactly UNIQUE (channel_id, fan_id)
-- ---------------------------------------------------------------------
SELECT conname,
       conrelid::regclass AS table_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.anonymous_links'::regclass
  AND contype = 'u'
ORDER BY conname;

DO $$
BEGIN
    IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'public.anonymous_links'::regclass AND contype = 'u') <> 1 THEN
        RAISE EXCEPTION 'anonymous_links must have exactly 1 unique constraint';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.anonymous_links'::regclass
                     AND contype = 'u'
                     AND pg_get_constraintdef(oid) =
                         'UNIQUE (channel_id, fan_id)') THEN
        RAISE EXCEPTION 'missing UNIQUE (channel_id, fan_id)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5b. One channel per creator + renamed quota counter (migration 0004)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.channels'::regclass
                     AND conname = 'uq_channels_creator'
                     AND contype = 'u') THEN
        RAISE EXCEPTION 'missing uq_channels_creator on channels';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'channels'
          AND column_name = 'pings_sent_this_period') THEN
        RAISE EXCEPTION 'channels.pings_sent_this_period missing (0004 rename)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'channels'
          AND column_name = 'sms_sent_this_period') THEN
        RAISE EXCEPTION 'channels.sms_sent_this_period must be renamed (0004)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 6. All foreign keys (creation order must not forward-reference)
-- ---------------------------------------------------------------------
SELECT conrelid::regclass AS table_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text;

-- ---------------------------------------------------------------------
-- 7. Indexes (ADR 0002 + wallet identity index from 0003)
-- ---------------------------------------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE schemaname = 'public'
                     AND indexname = 'idx_anonymous_links_channel_status') THEN
        RAISE EXCEPTION 'missing idx_anonymous_links_channel_status';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE schemaname = 'public'
                     AND indexname = 'uq_fans_wallet_address') THEN
        RAISE EXCEPTION 'missing uq_fans_wallet_address (0003)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 8. RLS policies (exactly the two from ADR 0002)
-- ---------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

DO $$
BEGIN
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') <> 2 THEN
        RAISE EXCEPTION 'Expected exactly 2 RLS policies, found %',
            (SELECT count(*) FROM pg_policies WHERE schemaname = 'public');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 9. Smoke test: insert one row per table (FK order) then roll back.
--    Runs as table owner, which bypasses RLS.
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO creators (id, email, handle)
VALUES ('00000000-0000-0000-0000-000000000001', 'schema-test@example.com', '@schema_test');

INSERT INTO channels (id, creator_id, handle, signing_key)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        '@schema_test_channel', 'test_signing_key');

INSERT INTO fans (id, wallet_address)
VALUES ('00000000-0000-0000-0000-000000000003', '0x0000000000000000000000000000000000000001');

INSERT INTO anonymous_links (channel_id, fan_id, status)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        'active');

INSERT INTO pings (id, channel_id, message, delivery_method)
VALUES ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002', 'schema smoke test', 'push');

INSERT INTO message_queue_jobs
    (ping_id, channel_id, fan_id, delivery_method, payload, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        'push', '{"message": "schema smoke test"}',
        '00000000-0000-0000-0000-000000000004:push');

SELECT 'smoke test rows inserted' AS result;

ROLLBACK;

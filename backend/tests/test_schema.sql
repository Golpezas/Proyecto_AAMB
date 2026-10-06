-- backend/tests/test_schema.sql
-- Verification queries for Task 2 (task brief Step 4) + structural checks.
--
-- Usage:  psql "$SUPABASE_DB_URL" -f backend/tests/test_schema.sql
-- Pre-req: migrations 0001_initial_schema.sql and 0002_rls_policies.sql applied.
-- Target: Supabase (0002 references auth.uid(), not present on vanilla Postgres).
-- A failed assertion raises an exception; with ON_ERROR_STOP the run aborts.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- 1. RLS enabled on ALL public tables (brief Step 4)
--    Expected: 7 rows, every rowsecurity = true
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
    IF (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') <> 7 THEN
        RAISE EXCEPTION 'Expected 7 public tables, found %',
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
-- 3. Controller ruling 1 & 2: channels.pin_hash exists,
--    anonymous_links.pin_hash must NOT exist
-- ---------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'channels' AND column_name = 'pin_hash')
    OR (table_name = 'anonymous_links' AND column_name LIKE '%pin%'))
ORDER BY table_name, column_name;

DO $$
BEGIN
    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'channels' AND column_name = 'pin_hash') <> 1 THEN
        RAISE EXCEPTION 'channels.pin_hash missing';
    END IF;
    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'anonymous_links' AND column_name = 'pin_hash') <> 0 THEN
        RAISE EXCEPTION 'anonymous_links.pin_hash must not exist (PIN is per-channel)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. anonymous_links columns exactly as ruled:
--    id, channel_id, fan_id, wallet_address, status, subscribed_at, opted_out_at
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
       <> ARRAY['id', 'channel_id', 'fan_id', 'wallet_address',
                'status', 'subscribed_at', 'opted_out_at']::text[] THEN
        RAISE EXCEPTION 'anonymous_links column set mismatch: %',
            (SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'anonymous_links');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. Unique constraints on anonymous_links
--    Expected: UNIQUE (channel_id, fan_id) and UNIQUE (channel_id, wallet_address)
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
        WHERE conrelid = 'public.anonymous_links'::regclass AND contype = 'u') <> 2 THEN
        RAISE EXCEPTION 'anonymous_links must have exactly 2 unique constraints';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.anonymous_links'::regclass
                     AND contype = 'u'
                     AND pg_get_constraintdef(oid) =
                         'UNIQUE (channel_id, fan_id)') THEN
        RAISE EXCEPTION 'missing UNIQUE (channel_id, fan_id)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.anonymous_links'::regclass
                     AND contype = 'u'
                     AND pg_get_constraintdef(oid) =
                         'UNIQUE (channel_id, wallet_address)') THEN
        RAISE EXCEPTION 'missing UNIQUE (channel_id, wallet_address)';
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
-- 7. Indexes (ADR 0002 + replacement of idx_anonymous_links_channel_pin)
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
    IF EXISTS (SELECT 1 FROM pg_indexes
               WHERE schemaname = 'public'
                 AND indexname = 'idx_anonymous_links_channel_pin') THEN
        RAISE EXCEPTION 'obsolete idx_anonymous_links_channel_pin present';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 8. RLS policies (exactly the two from ADR 0002)
--    encrypted_phones must have NO policy (no direct SELECT possible)
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
    IF EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'encrypted_phones') THEN
        RAISE EXCEPTION 'encrypted_phones must have no RLS policy';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 9. encrypted_phones PII isolation: RLS enabled, ZERO policies
--    (deny-all), and phone_encrypted is bytea (AES-256-GCM ciphertext
--    produced by the application layer -- no SQL decrypt function exists)
-- ---------------------------------------------------------------------
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'encrypted_phones')
           AS policy_count,
       a.attname AS column_name,
       format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'phone_encrypted'
WHERE n.nspname = 'public' AND c.relname = 'encrypted_phones';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = 'public'
                     AND c.relname = 'encrypted_phones'
                     AND c.relrowsecurity) THEN
        RAISE EXCEPTION 'RLS not enabled on encrypted_phones';
    END IF;
    IF (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'encrypted_phones') <> 0 THEN
        RAISE EXCEPTION 'encrypted_phones must have ZERO RLS policies (deny-all)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                   JOIN pg_class c ON c.oid = a.attrelid
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = 'public'
                     AND c.relname = 'encrypted_phones'
                     AND a.attname = 'phone_encrypted'
                     AND a.atttypid = 'bytea'::regtype) THEN
        RAISE EXCEPTION 'encrypted_phones.phone_encrypted must be type bytea';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'get_decrypted_phone') THEN
        RAISE EXCEPTION 'get_decrypted_phone must not exist (app-layer AES-256-GCM only)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 10. Smoke test: insert one row per table (FK order) then roll back.
--     Runs as table owner, which bypasses RLS.
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO creators (id, email, handle)
VALUES ('00000000-0000-0000-0000-000000000001', 'schema-test@example.com', '@schema_test');

INSERT INTO channels (id, creator_id, handle, signing_key, pin_hash)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        '@schema_test_channel', 'test_signing_key', '$2b$12$schema.test.pinhash');

INSERT INTO fans (id)
VALUES ('00000000-0000-0000-0000-000000000003');

INSERT INTO encrypted_phones (fan_id, phone_encrypted, encryption_key_id)
VALUES ('00000000-0000-0000-0000-000000000003', decode('00', 'hex'), 'test-key-1');

INSERT INTO anonymous_links (channel_id, fan_id, wallet_address, status)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        '0xSchemaTestWallet', 'active');

INSERT INTO pings (id, channel_id, message, delivery_method)
VALUES ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002', 'schema smoke test', 'sms');

INSERT INTO message_queue_jobs
    (ping_id, channel_id, fan_id, delivery_method, payload, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        'sms', '{"message": "schema smoke test"}',
        '00000000-0000-0000-0000-000000000004:sms');

SELECT 'smoke test rows inserted' AS result;

ROLLBACK;

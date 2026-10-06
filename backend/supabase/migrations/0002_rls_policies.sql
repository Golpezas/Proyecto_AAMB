-- backend/supabase/migrations/0002_rls_policies.sql
-- RLS policies + get_decrypted_phone() SECURITY DEFINER function
-- from ADR 0002.
--
-- Note: ADR 0002 only shows ALTER TABLE ... ENABLE ROW LEVEL SECURITY for
-- channels and anonymous_links, but task brief Step 4 requires ALL tables to
-- report rowsecurity=true. RLS is therefore enabled on every table; policies
-- remain exactly the two from the ADR. encrypted_phones gets RLS with NO
-- policies, so no role can SELECT it directly -- only get_decrypted_phone()
-- (SECURITY DEFINER) can read it.

-- Enable RLS on all tables
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue_jobs ENABLE ROW LEVEL SECURITY;

-- Creators see only their own channels
CREATE POLICY "creator_own_channels" ON channels
    FOR ALL USING (creator_id = auth.uid());

-- Fans see only their own links (via PIN/wallet auth)
CREATE POLICY "fan_own_links" ON anonymous_links
    FOR SELECT USING (fan_id = auth.uid());

-- NO POLICY allows reading encrypted_phones.phone_encrypted directly
-- Only SECURITY DEFINER function can decrypt

-- Function for SMS worker to get decrypted phone
-- Deviation from ADR 0002 (correctness fix): ADR declares
-- `SET search_path = ''` while referencing `encrypted_phones` and
-- `pgp_sym_decrypt` unqualified -- with an empty search_path those names
-- never resolve and the function fails at runtime. search_path is set to
-- `public, extensions` so both resolve (pgcrypto lives in `public` on plain
-- Postgres and in `extensions` on Supabase). Missing schemas in search_path
-- are ignored, so this is safe on either target.
CREATE OR REPLACE FUNCTION get_decrypted_phone(fan_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    phone TEXT;
BEGIN
    -- Verify caller is SMS worker (check role or API key)
    IF current_setting('request.jwt.claims', true)::json->>'role' != 'sms_worker' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT pgp_sym_decrypt(phone_encrypted, current_setting('app.encryption_key'))
    INTO phone
    FROM encrypted_phones
    WHERE fan_id = $1;

    RETURN phone;
END;
$$;

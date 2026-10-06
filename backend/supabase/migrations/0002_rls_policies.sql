-- backend/supabase/migrations/0002_rls_policies.sql
-- RLS policies from ADR 0002.
--
-- Note: ADR 0002 only shows ALTER TABLE ... ENABLE ROW LEVEL SECURITY for
-- channels and anonymous_links, but task brief Step 4 requires ALL tables to
-- report rowsecurity=true. RLS is therefore enabled on every table; policies
-- remain exactly the two from the ADR. encrypted_phones gets RLS with NO
-- policies (deny-all), so no API role can read it directly.
--
-- Phone number encryption (controller ruling): phone numbers are encrypted
-- with AES-256-GCM at the APPLICATION layer (backend/app/services/
-- crypto_service.py) and decrypted only ephemerally by the delivery worker
-- process at send time. There is deliberately NO SQL decrypt function:
-- pgcrypto's pgp_sym_decrypt (OpenPGP/CFB) cannot read AES-256-GCM
-- ciphertext, so any in-database decryptor would be incompatible with the
-- binding encryption design. PII isolation is enforced two ways:
--   (1) RLS deny-all on encrypted_phones (RLS enabled, zero policies) for
--       anon/authenticated roles;
--   (2) service_role-only access to the table at the API layer.

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

-- NO POLICY on encrypted_phones (deny-all): see header comment on phone
-- number encryption. No GRANT EXECUTE exists (and none may be added) for any
-- decrypt function -- decryption happens only in the application layer.

-- backend/supabase/migrations/0002_rls_policies.sql
-- RLS policies from ADR 0002.
--
-- Note: ADR 0002 only shows ALTER TABLE ... ENABLE ROW LEVEL SECURITY for
-- channels and anonymous_links, but task brief Step 4 requires ALL tables to
-- report rowsecurity=true. RLS is therefore enabled on every table; policies
-- remain exactly the two from the ADR.

-- Enable RLS on all tables
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue_jobs ENABLE ROW LEVEL SECURITY;

-- Creators see only their own channels
CREATE POLICY "creator_own_channels" ON channels
    FOR ALL USING (creator_id = auth.uid());

-- Fans see only their own links (via wallet auth)
CREATE POLICY "fan_own_links" ON anonymous_links
    FOR SELECT USING (fan_id = auth.uid());

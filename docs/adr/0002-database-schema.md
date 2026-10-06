# ADR 0002: Database Schema & RLS Policies

## Status
**Partially superseded by ADR 0006 (Hybrid Architecture).** The schema of
record is `backend/supabase/migrations/*.sql` (0001–0004+): phone columns,
`pin_hash`, `encrypted_phones`, and `get_decrypted_phone()` are removed by the
pivot; `device_tokens`, `fans.wallet_address`, and `pings.kind` are added.
Sections about encrypted phone storage and SMS are historical. RLS policies
(0002_rls_policies.sql) remain valid as defense-in-depth.

## Context
We need a PostgreSQL schema that enforces PII isolation at the database level. The phone number must never be readable by the Creator, the API layer, or admin dashboards — only by the SMS worker at send time.

## Decision
Use Supabase (PostgreSQL) with:
- **Row Level Security (RLS)** on all tables
- **Encrypted column** for phone numbers (pgcrypto)
- **Separate table** for encrypted phone numbers with no direct FK to Channel
- **RLS policies** that prevent SELECT on phone numbers except via SECURITY DEFINER function

## Schema

```sql
-- Core tables
CREATE TABLE creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    handle TEXT UNIQUE NOT NULL, -- @creatorname
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    handle TEXT UNIQUE NOT NULL,
    signing_key TEXT NOT NULL, -- for webhook verification
    subscription_tier TEXT DEFAULT 'free', -- free, pro, enterprise
    monthly_ping_limit INT DEFAULT 100,
    sms_sent_this_period INT DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Anonymous link: Channel ↔ PIN/Wallet ↔ Fan
-- NO phone number here
CREATE TABLE anonymous_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL, -- bcrypt hash of PIN
    wallet_address TEXT,    -- Privy embedded wallet address (optional)
    fan_id UUID REFERENCES fans(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active', -- active, opted_out, deleted
    subscribed_at TIMESTAMPTZ DEFAULT now(),
    opted_out_at TIMESTAMPTZ,
    UNIQUE (channel_id, pin_hash),
    UNIQUE (channel_id, wallet_address)
);

CREATE TABLE fans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Encrypted phone numbers - SEPARATE TABLE, no direct channel link
-- Only decryptable by SECURITY DEFINER function with worker role
CREATE TABLE encrypted_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fan_id UUID REFERENCES fans(id) ON DELETE CASCADE UNIQUE,
    phone_encrypted BYTEA NOT NULL, -- AES-256-GCM encrypted
    encryption_key_id TEXT NOT NULL, -- key rotation support
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    delivery_method TEXT NOT NULL, -- 'sms', 'push', 'both'
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE message_queue_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ping_id UUID REFERENCES pings(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    fan_id UUID REFERENCES fans(id) ON DELETE CASCADE,
    delivery_method TEXT NOT NULL,
    payload JSONB NOT NULL, -- {message, phone_encrypted?, push_token?}
    status TEXT DEFAULT 'queued', -- queued, processing, sent, failed, opted_out
    retry_count INT DEFAULT 0,
    error_message TEXT,
    idempotency_key TEXT UNIQUE NOT NULL, -- ping_id + fan_id + delivery_method
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_anonymous_links_channel_pin ON anonymous_links(channel_id, pin_hash);
CREATE INDEX idx_anonymous_links_wallet ON anonymous_links(wallet_address);
CREATE INDEX idx_message_queue_jobs_status ON message_queue_jobs(status);
CREATE INDEX idx_message_queue_jobs_idempotency ON message_queue_jobs(idempotency_key);
```

## RLS Policies

```sql
-- Creators see only their own channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator_own_channels" ON channels
    FOR ALL USING (creator_id = auth.uid());

-- Fans see only their own links (via PIN/wallet auth)
ALTER TABLE anonymous_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fan_own_links" ON anonymous_links
    FOR SELECT USING (fan_id = auth.uid());

-- NO POLICY allows reading encrypted_phones.phone_encrypted directly
-- Only SECURITY DEFINER function can decrypt

-- Function for SMS worker to get decrypted phone
CREATE OR REPLACE FUNCTION get_decrypted_phone(fan_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
```

## Consequences
- **Pros**: Database-enforced PII isolation, encryption at rest, key rotation support, audit trail
- **Cons**: Requires careful key management, SECURITY DEFINER functions need auditing
- **Migration**: Use Supabase migrations for version control

---

## Related
- ADR 0001: Tech Stack
- ADR 0003: Anonymous Link Architecture
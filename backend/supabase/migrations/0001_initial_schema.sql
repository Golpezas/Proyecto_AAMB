-- backend/supabase/migrations/0001_initial_schema.sql
-- Full schema from ADR 0002: creators, channels, fans,
-- encrypted_phones, anonymous_links, pings, message_queue_jobs
-- + indexes + unique constraints
--
-- Corrections vs ADR 0002 (controller rulings):
--   1. channels.pin_hash added (bcrypt hash of the creator's
--      single broadcast PIN, shared with all fans).
--   2. anonymous_links has NO pin_hash; uniqueness is
--      UNIQUE (channel_id, fan_id) and UNIQUE (channel_id, wallet_address).
--   3. Creation order fixed so foreign keys never forward-reference:
--      creators -> channels -> fans -> encrypted_phones ->
--      anonymous_links -> pings -> message_queue_jobs.
--   4. idx_anonymous_links_channel_pin (referenced removed column)
--      replaced with idx_anonymous_links_channel_status for fan-out queries.

-- pgcrypto: gen_random_uuid() + pgp_sym_decrypt() used below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
    pin_hash TEXT, -- bcrypt hash of creator's broadcast PIN (correction vs ADR 0002)
    subscription_tier TEXT DEFAULT 'free', -- free, pro, enterprise
    monthly_ping_limit INT DEFAULT 100,
    sms_sent_this_period INT DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
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

-- Anonymous link: Channel <-> Wallet <-> Fan
-- NO phone number here, NO pin_hash here (PIN is per-channel, not per-fan)
CREATE TABLE anonymous_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    fan_id UUID REFERENCES fans(id) ON DELETE CASCADE,
    wallet_address TEXT,    -- Privy embedded wallet address (optional)
    status TEXT DEFAULT 'active', -- active, opted_out, deleted
    subscribed_at TIMESTAMPTZ DEFAULT now(),
    opted_out_at TIMESTAMPTZ,
    UNIQUE (channel_id, fan_id),
    UNIQUE (channel_id, wallet_address)
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
CREATE INDEX idx_anonymous_links_channel_status ON anonymous_links(channel_id, status);
CREATE INDEX idx_anonymous_links_wallet ON anonymous_links(wallet_address);
CREATE INDEX idx_message_queue_jobs_status ON message_queue_jobs(status);
CREATE INDEX idx_message_queue_jobs_idempotency ON message_queue_jobs(idempotency_key);

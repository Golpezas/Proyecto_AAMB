-- ADR 0006 zone 3: pseudonymous routing data only. RLS enabled with no
-- policies -> service-role/API path only (defense-in-depth).
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fan_id UUID NOT NULL REFERENCES fans(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,       -- OneSignal.User.onesignalId
    platform TEXT NOT NULL DEFAULT 'web',  -- web, ios, android
    created_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_device_tokens_fan ON device_tokens(fan_id);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

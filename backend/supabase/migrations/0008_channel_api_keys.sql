-- ADR 0006 (2026-10-06 revision): machine callers (BreakSuite6) use a
-- per-channel API key; only the SHA-256 hash is stored.
ALTER TABLE channels ADD COLUMN api_key_hash TEXT;
CREATE UNIQUE INDEX idx_channels_api_key_hash
    ON channels(api_key_hash) WHERE api_key_hash IS NOT NULL;
-- ADR 0006: go-live status and timestamp for channels
ALTER TABLE channels ADD COLUMN is_live BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE channels ADD COLUMN live_since TIMESTAMPTZ;
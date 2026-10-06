-- ADR 0006: pings are either creator messages or automatic go-live alerts.
ALTER TABLE pings ADD COLUMN kind TEXT NOT NULL DEFAULT 'message';
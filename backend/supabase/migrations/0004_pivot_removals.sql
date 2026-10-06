-- backend/supabase/migrations/0004_pivot_removals.sql
-- ADR 0006: remove phone/PIN machinery; enforce one channel per creator;
-- rename the SMS counter to the product-quota counter.
DROP TABLE IF EXISTS encrypted_phones;
ALTER TABLE channels DROP COLUMN IF EXISTS pin_hash;
ALTER TABLE anonymous_links DROP COLUMN IF EXISTS wallet_address;
ALTER TABLE channels ADD CONSTRAINT uq_channels_creator UNIQUE (creator_id);
ALTER TABLE channels RENAME COLUMN sms_sent_this_period TO pings_sent_this_period;

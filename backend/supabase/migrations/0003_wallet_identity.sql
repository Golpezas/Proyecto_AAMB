-- ADR 0006: fan identity is the embedded-wallet address (no phone, no PIN).
ALTER TABLE fans ADD COLUMN wallet_address TEXT NOT NULL;
CREATE UNIQUE INDEX uq_fans_wallet_address ON fans(wallet_address);

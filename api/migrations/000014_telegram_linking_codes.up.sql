-- Temporary codes for linking Telegram accounts
CREATE TABLE telegram_linking_codes (
    code VARCHAR(8) PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_telegram_linking_codes_driver ON telegram_linking_codes(driver_id);
CREATE INDEX idx_telegram_linking_codes_expires ON telegram_linking_codes(expires_at) WHERE used_at IS NULL;

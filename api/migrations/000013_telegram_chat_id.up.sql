-- Add Telegram chat ID to driver_status for bot notifications
ALTER TABLE driver_status ADD COLUMN telegram_chat_id BIGINT;

-- Index for quick lookup when verifying linking codes
CREATE INDEX idx_driver_status_telegram ON driver_status(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

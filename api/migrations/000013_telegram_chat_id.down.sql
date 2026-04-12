-- Remove Telegram chat ID from driver_status
DROP INDEX IF EXISTS idx_driver_status_telegram;
ALTER TABLE driver_status DROP COLUMN IF EXISTS telegram_chat_id;

-- Add auto-increment order number to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number BIGSERIAL;

-- Add notification sound URL to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_sound_url TEXT;

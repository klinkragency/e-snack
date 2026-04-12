DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payment_webhook_events;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_intent_id_unique;

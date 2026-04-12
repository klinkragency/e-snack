-- Allow admins to hard-delete restaurants even when historical orders
-- reference them. Mirrors the approach used in migration 000032 for
-- products, formulas and option choices.

BEGIN;

ALTER TABLE orders
    ALTER COLUMN restaurant_id DROP NOT NULL;

ALTER TABLE orders
    DROP CONSTRAINT orders_restaurant_id_fkey,
    ADD CONSTRAINT orders_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL;

COMMIT;

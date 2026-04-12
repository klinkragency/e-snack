-- Note: we keep restaurant_id nullable even on rollback, because rows created
-- while the new behaviour was active may hold NULLs and reimposing NOT NULL
-- would fail.

BEGIN;

ALTER TABLE orders
    DROP CONSTRAINT orders_restaurant_id_fkey,
    ADD CONSTRAINT orders_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);

COMMIT;

-- Remove promo_code_id from orders
ALTER TABLE orders DROP COLUMN IF EXISTS promo_code_id;

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS promo_usage;
DROP TABLE IF EXISTS promo_code_restaurants;
DROP TABLE IF EXISTS promo_codes;

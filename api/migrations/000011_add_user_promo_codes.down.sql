-- Remove columns from promo_usage
ALTER TABLE promo_usage DROP COLUMN IF EXISTS user_promo_code_id;
ALTER TABLE promo_usage DROP COLUMN IF EXISTS source;

-- Drop user_promo_codes table
DROP TABLE IF EXISTS user_promo_codes;

-- Remove columns from promo_codes
ALTER TABLE promo_codes DROP COLUMN IF EXISTS requires_claim;
ALTER TABLE promo_codes DROP COLUMN IF EXISTS is_private;

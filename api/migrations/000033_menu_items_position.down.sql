BEGIN;

DROP INDEX IF EXISTS idx_products_category_position;
DROP INDEX IF EXISTS idx_formulas_category_position;

ALTER TABLE products DROP COLUMN IF EXISTS position;
ALTER TABLE formulas DROP COLUMN IF EXISTS position;

COMMIT;

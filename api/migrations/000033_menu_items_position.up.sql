-- Add explicit ordering columns to products and formulas so the admin can
-- drag-and-drop items inside a category and move them across categories.
-- Existing rows keep their current visual order: positions are seeded from
-- created_at ASC, scoped to each category.

BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

UPDATE products p
SET position = sub.rn - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC) AS rn
    FROM products
) sub
WHERE p.id = sub.id;

UPDATE formulas f
SET position = sub.rn - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC) AS rn
    FROM formulas
) sub
WHERE f.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_products_category_position ON products(category_id, position);
CREATE INDEX IF NOT EXISTS idx_formulas_category_position ON formulas(category_id, position);

COMMIT;

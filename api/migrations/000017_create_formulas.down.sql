DROP TABLE IF EXISTS order_formula_product_options;
DROP TABLE IF EXISTS order_formula_products;

DROP INDEX IF EXISTS idx_order_items_formula;

ALTER TABLE order_items
    DROP COLUMN IF EXISTS formula_name,
    DROP COLUMN IF EXISTS formula_id,
    DROP COLUMN IF EXISTS item_type;

-- Note: not restoring product_id NOT NULL here to avoid breaking existing data

DROP TABLE IF EXISTS formula_products;
DROP TABLE IF EXISTS formulas;

-- Add choice group support to formula products.
-- When group_label IS NULL → fixed product (included automatically).
-- When group_label IS NOT NULL → choice group (customer picks one from products sharing the same label).
ALTER TABLE formula_products
    ADD COLUMN group_label VARCHAR(255);

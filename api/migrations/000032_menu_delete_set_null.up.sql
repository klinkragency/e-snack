-- Allow admins to hard-delete products, formulas, categories and option choices
-- even when historical orders reference them.
--
-- Strategy: switch the order-side FKs from NO ACTION to ON DELETE SET NULL.
-- Order rows already carry snapshot columns (product_name, formula_name,
-- option_name, choice_name, price_modifier), so the referential pointer is
-- only used for navigation and can safely be nulled out.

BEGIN;

-- order_items.product_id — already nullable (since migration 000017)
ALTER TABLE order_items
    DROP CONSTRAINT order_items_product_id_fkey,
    ADD CONSTRAINT order_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- order_items.formula_id — already nullable (since migration 000017)
ALTER TABLE order_items
    DROP CONSTRAINT order_items_formula_id_fkey,
    ADD CONSTRAINT order_items_formula_id_fkey
        FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE SET NULL;

-- order_item_options.option_choice_id — currently NOT NULL and NO ACTION
ALTER TABLE order_item_options
    ALTER COLUMN option_choice_id DROP NOT NULL;

ALTER TABLE order_item_options
    DROP CONSTRAINT order_item_options_option_choice_id_fkey,
    ADD CONSTRAINT order_item_options_option_choice_id_fkey
        FOREIGN KEY (option_choice_id) REFERENCES option_choices(id) ON DELETE SET NULL;

-- order_formula_products.product_id — already nullable (since migration 000017)
ALTER TABLE order_formula_products
    DROP CONSTRAINT order_formula_products_product_id_fkey,
    ADD CONSTRAINT order_formula_products_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- order_formula_product_options.option_choice_id — already nullable (since 000017)
ALTER TABLE order_formula_product_options
    DROP CONSTRAINT order_formula_product_options_option_choice_id_fkey,
    ADD CONSTRAINT order_formula_product_options_option_choice_id_fkey
        FOREIGN KEY (option_choice_id) REFERENCES option_choices(id) ON DELETE SET NULL;

COMMIT;

-- Revert ON DELETE SET NULL back to NO ACTION on menu-to-order FKs.
-- Note: order_item_options.option_choice_id is left nullable even on rollback,
-- because rows created while the new behaviour was active may hold NULLs and
-- reimposing NOT NULL would fail.

BEGIN;

ALTER TABLE order_items
    DROP CONSTRAINT order_items_product_id_fkey,
    ADD CONSTRAINT order_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id);

ALTER TABLE order_items
    DROP CONSTRAINT order_items_formula_id_fkey,
    ADD CONSTRAINT order_items_formula_id_fkey
        FOREIGN KEY (formula_id) REFERENCES formulas(id);

ALTER TABLE order_item_options
    DROP CONSTRAINT order_item_options_option_choice_id_fkey,
    ADD CONSTRAINT order_item_options_option_choice_id_fkey
        FOREIGN KEY (option_choice_id) REFERENCES option_choices(id);

ALTER TABLE order_formula_products
    DROP CONSTRAINT order_formula_products_product_id_fkey,
    ADD CONSTRAINT order_formula_products_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id);

ALTER TABLE order_formula_product_options
    DROP CONSTRAINT order_formula_product_options_option_choice_id_fkey,
    ADD CONSTRAINT order_formula_product_options_option_choice_id_fkey
        FOREIGN KEY (option_choice_id) REFERENCES option_choices(id);

COMMIT;

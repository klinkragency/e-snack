-- Formulas: combo menus belonging to a category (like products)
CREATE TABLE formulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products included in a formula (each keeps its own options)
CREATE TABLE formula_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(formula_id, product_id)
);

-- Extend order_items to support formula line items
ALTER TABLE order_items
    ALTER COLUMN product_id DROP NOT NULL,
    ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'product',
    ADD COLUMN formula_id UUID REFERENCES formulas(id),
    ADD COLUMN formula_name VARCHAR(255);

-- Snapshot of products within an ordered formula
CREATE TABLE order_formula_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot of selected options per formula product
CREATE TABLE order_formula_product_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_formula_product_id UUID NOT NULL REFERENCES order_formula_products(id) ON DELETE CASCADE,
    option_choice_id UUID REFERENCES option_choices(id),
    option_name VARCHAR(255) NOT NULL,
    choice_name VARCHAR(255) NOT NULL,
    price_modifier DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formulas_category ON formulas(category_id);
CREATE INDEX idx_formula_products_formula ON formula_products(formula_id);
CREATE INDEX idx_order_items_formula ON order_items(formula_id);
CREATE INDEX idx_order_formula_products_item ON order_formula_products(order_item_id);
CREATE INDEX idx_order_formula_product_options_product ON order_formula_product_options(order_formula_product_id);

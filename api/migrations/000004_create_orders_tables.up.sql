-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),

    -- Order type: delivery, pickup, dine_in
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('delivery', 'pickup', 'dine_in')),

    -- Current status
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Waiting for payment
        'confirmed',         -- Payment confirmed, preparing
        'preparing',         -- Kitchen is preparing
        'ready',             -- Ready for pickup/delivery
        'out_for_delivery',  -- Driver has picked up (delivery only)
        'delivered',         -- Completed
        'cancelled',         -- Cancelled
        'refunded'           -- Refunded
    )),

    -- Pricing
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Delivery info (for delivery type)
    delivery_address TEXT,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    delivery_instructions TEXT,

    -- Dine-in info
    table_number VARCHAR(20),

    -- Pickup info
    scheduled_pickup_time TIMESTAMPTZ,

    -- Payment info
    payment_intent_id VARCHAR(255),
    payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),

    -- Promo code
    promo_code_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),

    -- Snapshot of product info at order time
    product_name VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),

    -- Total for this item (unit_price * quantity + options modifiers)
    total DECIMAL(10, 2) NOT NULL,

    -- Special instructions
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order item options (selected choices)
CREATE TABLE order_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_choice_id UUID NOT NULL REFERENCES option_choices(id),

    -- Snapshot of choice info at order time
    option_name VARCHAR(255) NOT NULL,
    choice_name VARCHAR(255) NOT NULL,
    price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order status history for audit trail
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES users(id),  -- Who changed the status
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_intent ON orders(payment_intent_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_item_options_item_id ON order_item_options(order_item_id);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- Promo Codes Table
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_delivery')),
    discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_order_amount DECIMAL(10, 2),
    max_discount_amount DECIMAL(10, 2),
    max_total_uses INT,
    max_uses_per_user INT DEFAULT 1,
    first_order_only BOOLEAN DEFAULT FALSE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    current_uses INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on code (case-insensitive)
CREATE UNIQUE INDEX idx_promo_codes_code ON promo_codes (UPPER(code));

-- Index for active promo lookup
CREATE INDEX idx_promo_codes_active ON promo_codes (is_active, starts_at, expires_at);

-- Promo Code Restaurant Restrictions (many-to-many)
CREATE TABLE promo_code_restaurants (
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    PRIMARY KEY (promo_code_id, restaurant_id)
);

-- Promo Usage Tracking
CREATE TABLE promo_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    discount_applied DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user usage count
CREATE INDEX idx_promo_usage_user ON promo_usage (promo_code_id, user_id);

-- Index for order lookup
CREATE INDEX idx_promo_usage_order ON promo_usage (order_id);

-- Add promo_code_id to orders table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'promo_code_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;
    END IF;
END $$;

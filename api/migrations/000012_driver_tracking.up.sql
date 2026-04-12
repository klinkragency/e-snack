-- Add driver_id to orders for tracking which driver is assigned
ALTER TABLE orders ADD COLUMN driver_id UUID REFERENCES users(id);
CREATE INDEX idx_orders_driver_id ON orders(driver_id);

-- Real-time GPS position of drivers
CREATE TABLE driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2),          -- Direction 0-360 degrees
    speed DECIMAL(5, 2),            -- Speed in km/h
    accuracy DECIMAL(8, 2),         -- GPS accuracy in meters
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Driver availability status
CREATE TABLE driver_status (
    driver_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'offline'
        CHECK (status IN ('offline', 'available', 'busy', 'on_delivery')),
    current_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    phone VARCHAR(20),              -- WhatsApp phone number
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_status_status ON driver_status(status);

-- Delivery assignment history and workflow
CREATE TABLE delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE(order_id, driver_id)
);

CREATE INDEX idx_delivery_assignments_order ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_assignments_driver ON delivery_assignments(driver_id);
CREATE INDEX idx_delivery_assignments_status ON delivery_assignments(status);

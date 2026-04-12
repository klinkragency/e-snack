-- Add is_private flag to promo_codes (private codes require assignment to users)
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Add requires_claim flag (user must claim before using)
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS requires_claim BOOLEAN DEFAULT FALSE;

-- Table for user-specific promo code assignments
CREATE TABLE user_promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'claimed', 'used', 'revoked', 'expired')),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin who assigned
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_reason TEXT,
    expires_at TIMESTAMPTZ, -- Per-user expiration (overrides promo expiration)
    notes TEXT, -- Admin notes about this assignment
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(promo_code_id, user_id)
);

-- Indexes
CREATE INDEX idx_user_promo_codes_user ON user_promo_codes (user_id, status);
CREATE INDEX idx_user_promo_codes_promo ON user_promo_codes (promo_code_id, status);
CREATE INDEX idx_user_promo_codes_status ON user_promo_codes (status, expires_at);

-- Add source tracking to promo_usage (how the code was obtained)
ALTER TABLE promo_usage ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct';
-- sources: direct (entered code), claimed (from claimed assignment), gifted (admin gift), referral, etc.

-- Add user_promo_code_id reference to track which assignment was used
ALTER TABLE promo_usage ADD COLUMN IF NOT EXISTS user_promo_code_id UUID REFERENCES user_promo_codes(id) ON DELETE SET NULL;

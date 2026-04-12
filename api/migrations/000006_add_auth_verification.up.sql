-- Add verification and security fields to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45);

CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_phone_verified ON users(phone_verified);
CREATE INDEX idx_users_locked_until ON users(locked_until);

-- OTP codes table for verification and password reset
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    otp_type VARCHAR(50) NOT NULL,  -- 'email_verify', 'phone_verify', 'password_reset', '2fa_login'
    destination VARCHAR(255),         -- Email or phone number
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_active_otp UNIQUE(user_id, otp_type)
);

CREATE INDEX idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX idx_otp_codes_type ON otp_codes(otp_type);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- User sessions table for advanced session management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_fingerprint VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_revoked_at ON user_sessions(revoked_at);

-- OTP audit trail for compliance and security
CREATE TABLE otp_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    otp_id UUID REFERENCES otp_codes(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,  -- 'created', 'verified', 'failed_attempt', 'expired', 'revoked'
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_otp_audit_user_id ON otp_audit(user_id);
CREATE INDEX idx_otp_audit_action ON otp_audit(action);
CREATE INDEX idx_otp_audit_created_at ON otp_audit(created_at);

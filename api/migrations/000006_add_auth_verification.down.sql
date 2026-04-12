-- Drop audit table first (has foreign keys)
DROP TABLE IF EXISTS otp_audit;

-- Drop sessions table
DROP TABLE IF EXISTS user_sessions;

-- Drop OTP codes table
DROP TABLE IF EXISTS otp_codes;

-- Remove user verification and security columns
ALTER TABLE users DROP COLUMN IF EXISTS last_login_ip;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE users DROP COLUMN IF EXISTS phone_verified;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;

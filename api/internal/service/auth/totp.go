package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"image/png"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/redis/go-redis/v9"
)

const (
	totpIssuer       = "Beldy's Club"
	backupCodeCount  = 8
	backupCodeLength = 8
	twoFATokenTTL    = 5 * time.Minute
)

// GenerateTOTPSecret creates a new TOTP key for a user and returns the secret + QR data URI.
func GenerateTOTPSecret(email string) (secret string, qrDataURI string, err error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      totpIssuer,
		AccountName: email,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP key: %w", err)
	}

	// Generate QR code image
	img, err := key.Image(200, 200)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate QR image: %w", err)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", "", fmt.Errorf("failed to encode QR PNG: %w", err)
	}

	dataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	return key.Secret(), dataURI, nil
}

// ValidateTOTPCode checks a 6-digit code against the secret.
func ValidateTOTPCode(secret, code string) bool {
	return totp.Validate(code, secret)
}

// GenerateBackupCodes creates random hex backup codes.
func GenerateBackupCodes() ([]string, error) {
	codes := make([]string, backupCodeCount)
	for i := 0; i < backupCodeCount; i++ {
		b := make([]byte, backupCodeLength/2)
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
		codes[i] = fmt.Sprintf("%x", b)
	}
	return codes, nil
}

// Store2FAToken stores a temporary token in Redis for the 2FA login challenge.
func Store2FAToken(ctx context.Context, rdb *redis.Client, token, userID string) error {
	return rdb.Set(ctx, "2fa:"+token, userID, twoFATokenTTL).Err()
}

// Get2FATokenUserID retrieves and deletes the user ID associated with a 2FA token.
func Get2FATokenUserID(ctx context.Context, rdb *redis.Client, token string) (string, error) {
	key := "2fa:" + token
	userID, err := rdb.Get(ctx, key).Result()
	if err != nil {
		return "", fmt.Errorf("invalid or expired 2FA token")
	}
	rdb.Del(ctx, key)
	return userID, nil
}

// StoreBackupCodes saves hashed backup codes in Redis (SET).
func StoreBackupCodes(ctx context.Context, rdb *redis.Client, userID string, codes []string) error {
	key := "backup_codes:" + userID
	rdb.Del(ctx, key)
	for _, code := range codes {
		hash, err := HashPassword(code)
		if err != nil {
			return err
		}
		rdb.SAdd(ctx, key, hash)
	}
	return nil
}

// ValidateBackupCode checks if a code matches any stored backup code and removes it.
func ValidateBackupCode(ctx context.Context, rdb *redis.Client, userID, code string) bool {
	key := "backup_codes:" + userID
	hashes, err := rdb.SMembers(ctx, key).Result()
	if err != nil {
		return false
	}
	for _, hash := range hashes {
		if CheckPassword(code, hash) {
			rdb.SRem(ctx, key, hash)
			return true
		}
	}
	return false
}

package auth

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/klinkragency/e-snack/internal/repository"
	"github.com/klinkragency/e-snack/internal/service/email"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const (
	OTPLength      = 6
	OTPExpiry      = 10 * time.Minute
	OTPMaxAttempts = 5
	RateLimitMax   = 3
	RateLimitWindow = 30 * time.Minute
)

type OTPService struct {
	otpRepo   repository.OTPRepository
	userRepo  repository.UserRepository
	redis     *redis.Client
	emailSvc  email.EmailService
}

func NewOTPService(
	otpRepo repository.OTPRepository,
	userRepo repository.UserRepository,
	redis *redis.Client,
	emailSvc email.EmailService,
) *OTPService {
	return &OTPService{
		otpRepo:  otpRepo,
		userRepo: userRepo,
		redis:    redis,
		emailSvc: emailSvc,
	}
}

// GenerateOTP generates a 6-digit random code
func (s *OTPService) GenerateOTP() (string, error) {
	max := big.NewInt(900000)
	num, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	code := num.Int64() + 100000
	return fmt.Sprintf("%06d", code), nil
}

// SendEmailVerification sends an OTP for email verification
func (s *OTPService) SendEmailVerification(ctx context.Context, userID, emailAddr string) error {
	// 1. Rate limiting check
	if !s.checkRateLimit(ctx, userID, "email_verify") {
		return fmt.Errorf("trop de tentatives, réessayez dans 30 minutes")
	}

	// 2. Generate code
	code, err := s.GenerateOTP()
	if err != nil {
		return fmt.Errorf("failed to generate OTP: %w", err)
	}

	// 3. Hash the code
	codeHash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash OTP: %w", err)
	}

	// 4. Store in DB (replaces old one if exists due to UNIQUE constraint)
	otp := &repository.OTPCode{
		UserID:      userID,
		CodeHash:    string(codeHash),
		OTPType:     "email_verify",
		Destination: emailAddr,
		MaxAttempts: OTPMaxAttempts,
		ExpiresAt:   time.Now().Add(OTPExpiry),
	}
	if err := s.otpRepo.Create(ctx, otp); err != nil {
		return fmt.Errorf("failed to store OTP: %w", err)
	}

	// 5. Store in Redis for fast validation
	redisKey := fmt.Sprintf("otp:%s:email_verify", userID)
	if err := s.redis.Set(ctx, redisKey, string(codeHash), OTPExpiry).Err(); err != nil {
		return fmt.Errorf("failed to cache OTP: %w", err)
	}

	// 6. Send email
	if err := s.emailSvc.SendVerificationCode(ctx, emailAddr, code); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// VerifyEmailCode verifies the code and marks email as verified
func (s *OTPService) VerifyEmailCode(ctx context.Context, userID, code string) error {
	// 1. Retrieve active OTP
	otp, err := s.otpRepo.GetActiveByUserAndType(ctx, userID, "email_verify")
	if err != nil {
		return fmt.Errorf("code invalide ou expiré")
	}

	// 2. Check attempts
	if otp.AttemptCount >= otp.MaxAttempts {
		return fmt.Errorf("trop de tentatives échouées")
	}

	// 3. Increment counter
	if err := s.otpRepo.IncrementAttempts(ctx, otp.ID); err != nil {
		return fmt.Errorf("failed to increment attempts: %w", err)
	}

	// 4. Verify code (bcrypt compare)
	if err := bcrypt.CompareHashAndPassword([]byte(otp.CodeHash), []byte(code)); err != nil {
		return fmt.Errorf("code incorrect")
	}

	// 5. Mark OTP as verified
	if err := s.otpRepo.MarkAsVerified(ctx, otp.ID); err != nil {
		return fmt.Errorf("failed to mark OTP as verified: %w", err)
	}

	// 6. Mark user.email_verified = true
	if err := s.userRepo.MarkEmailVerified(ctx, userID); err != nil {
		return fmt.Errorf("failed to mark email as verified: %w", err)
	}

	// 7. Delete from Redis
	redisKey := fmt.Sprintf("otp:%s:email_verify", userID)
	s.redis.Del(ctx, redisKey)

	return nil
}

// SendPasswordReset sends an OTP for password reset
func (s *OTPService) SendPasswordReset(ctx context.Context, emailAddr string) error {
	// 1. Verify user exists
	user, err := s.userRepo.GetByEmail(ctx, emailAddr)
	if err != nil {
		// Don't reveal if email exists (security)
		return nil
	}

	// 2. Rate limiting
	if !s.checkRateLimit(ctx, user.ID, "password_reset") {
		return fmt.Errorf("trop de tentatives, réessayez dans 30 minutes")
	}

	// 3. Generate + hash code
	code, err := s.GenerateOTP()
	if err != nil {
		return fmt.Errorf("failed to generate OTP: %w", err)
	}

	codeHash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash OTP: %w", err)
	}

	// 4. Store (30 min expiry for password reset)
	otp := &repository.OTPCode{
		UserID:      user.ID,
		CodeHash:    string(codeHash),
		OTPType:     "password_reset",
		Destination: emailAddr,
		MaxAttempts: OTPMaxAttempts,
		ExpiresAt:   time.Now().Add(30 * time.Minute),
	}
	if err := s.otpRepo.Create(ctx, otp); err != nil {
		return fmt.Errorf("failed to store OTP: %w", err)
	}

	// 5. Redis
	redisKey := fmt.Sprintf("otp:%s:password_reset", user.ID)
	if err := s.redis.Set(ctx, redisKey, string(codeHash), 30*time.Minute).Err(); err != nil {
		return fmt.Errorf("failed to cache OTP: %w", err)
	}

	// 6. Send email
	if err := s.emailSvc.SendPasswordResetCode(ctx, emailAddr, code); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// VerifyPasswordResetCode verifies the code and generates a reset token
func (s *OTPService) VerifyPasswordResetCode(ctx context.Context, emailAddr, code string) (string, error) {
	// 1. Find user
	user, err := s.userRepo.GetByEmail(ctx, emailAddr)
	if err != nil {
		return "", fmt.Errorf("code invalide")
	}

	// 2. Retrieve OTP
	otp, err := s.otpRepo.GetActiveByUserAndType(ctx, user.ID, "password_reset")
	if err != nil {
		return "", fmt.Errorf("code invalide ou expiré")
	}

	// 3. Check attempts
	if otp.AttemptCount >= otp.MaxAttempts {
		return "", fmt.Errorf("trop de tentatives échouées")
	}

	if err := s.otpRepo.IncrementAttempts(ctx, otp.ID); err != nil {
		return "", fmt.Errorf("failed to increment attempts: %w", err)
	}

	// 4. Verify code
	if err := bcrypt.CompareHashAndPassword([]byte(otp.CodeHash), []byte(code)); err != nil {
		return "", fmt.Errorf("code incorrect")
	}

	// 5. Mark verified
	if err := s.otpRepo.MarkAsVerified(ctx, otp.ID); err != nil {
		return "", fmt.Errorf("failed to mark OTP as verified: %w", err)
	}

	// 6. Generate a cryptographically random reset token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate reset token: %w", err)
	}
	resetToken := fmt.Sprintf("%x", tokenBytes)

	// Store reset token in Redis with 15 min TTL
	redisKey := fmt.Sprintf("reset_token:%s", resetToken)
	if err := s.redis.Set(ctx, redisKey, user.ID, 15*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("failed to store reset token: %w", err)
	}

	return resetToken, nil
}

// ResetPassword resets the password with the reset token
func (s *OTPService) ResetPassword(ctx context.Context, resetToken, newPassword string) error {
	// 1. Validate reset token
	redisKey := fmt.Sprintf("reset_token:%s", resetToken)
	userID, err := s.redis.Get(ctx, redisKey).Result()
	if err != nil {
		return fmt.Errorf("token invalide ou expiré")
	}

	// 2. Hash new password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 3. Update password
	if err := s.userRepo.UpdatePassword(ctx, userID, string(passwordHash)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// 4. Revoke all refresh tokens (logout everywhere for security)
	refreshKey := fmt.Sprintf("refresh:%s", userID)
	s.redis.Del(ctx, refreshKey)

	// 5. Delete reset token
	s.redis.Del(ctx, redisKey)

	return nil
}

// checkRateLimit checks if user has exceeded rate limit for OTP requests
func (s *OTPService) checkRateLimit(ctx context.Context, userID, otpType string) bool {
	key := fmt.Sprintf("otp:rate:%s:%s", userID, otpType)
	count, err := s.redis.Incr(ctx, key).Result()
	if err != nil {
		return true // Allow on error to not block legitimate users
	}
	if count == 1 {
		s.redis.Expire(ctx, key, RateLimitWindow)
	}
	return count <= RateLimitMax // Max 3 OTP requests per 30 min
}

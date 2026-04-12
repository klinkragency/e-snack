package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authv1 "github.com/klinkragency/e-snack/gen/auth/v1"
)

func (s *Service) Setup2FA(ctx context.Context, req *authv1.Setup2FARequest) (*authv1.Setup2FAResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if user.TwoFactorEnabled {
		return nil, status.Error(codes.FailedPrecondition, "2FA is already enabled")
	}

	secret, qrDataURI, err := GenerateTOTPSecret(user.Email)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate TOTP secret")
	}

	// Store the secret (not yet enabled)
	if err := s.userRepo.UpdateTOTPSecret(ctx, userID, &secret); err != nil {
		return nil, status.Error(codes.Internal, "failed to store TOTP secret")
	}

	return &authv1.Setup2FAResponse{
		Secret: secret,
		QrCode: qrDataURI,
	}, nil
}

func (s *Service) Enable2FA(ctx context.Context, req *authv1.Enable2FARequest) (*authv1.Enable2FAResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if req.Code == "" || len(req.Code) != 6 {
		return nil, status.Error(codes.InvalidArgument, "a 6-digit code is required")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if user.TwoFactorEnabled {
		return nil, status.Error(codes.FailedPrecondition, "2FA is already enabled")
	}

	if user.TOTPSecret == nil {
		return nil, status.Error(codes.FailedPrecondition, "call Setup2FA first")
	}

	if !ValidateTOTPCode(*user.TOTPSecret, req.Code) {
		return nil, status.Error(codes.InvalidArgument, "invalid TOTP code")
	}

	if err := s.userRepo.Enable2FA(ctx, userID); err != nil {
		return nil, status.Error(codes.Internal, "failed to enable 2FA")
	}

	backupCodes, err := GenerateBackupCodes()
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate backup codes")
	}

	if err := StoreBackupCodes(ctx, s.redis, userID, backupCodes); err != nil {
		return nil, status.Error(codes.Internal, "failed to store backup codes")
	}

	return &authv1.Enable2FAResponse{
		Success:     true,
		BackupCodes: backupCodes,
	}, nil
}

func (s *Service) Disable2FA(ctx context.Context, req *authv1.Disable2FARequest) (*authv1.Disable2FAResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "code is required")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if !user.TwoFactorEnabled || user.TOTPSecret == nil {
		return nil, status.Error(codes.FailedPrecondition, "2FA is not enabled")
	}

	// Accept TOTP code or backup code
	valid := ValidateTOTPCode(*user.TOTPSecret, req.Code) || ValidateBackupCode(ctx, s.redis, userID, req.Code)
	if !valid {
		return nil, status.Error(codes.InvalidArgument, "invalid code")
	}

	if err := s.userRepo.Disable2FA(ctx, userID); err != nil {
		return nil, status.Error(codes.Internal, "failed to disable 2FA")
	}

	// Clean up backup codes
	s.redis.Del(ctx, "backup_codes:"+userID)

	return &authv1.Disable2FAResponse{
		Success: true,
		Message: "2FA disabled successfully",
	}, nil
}

const max2FAAttempts = 5

func (s *Service) Verify2FA(ctx context.Context, req *authv1.Verify2FARequest) (*authv1.AuthResponse, error) {
	if req.TwoFaToken == "" || req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "two_fa_token and code are required")
	}

	// Rate limit by token
	attemptsKey := "2fa_attempts:" + req.TwoFaToken
	attempts, _ := s.redis.Incr(ctx, attemptsKey).Result()
	if attempts == 1 {
		s.redis.Expire(ctx, attemptsKey, 5*time.Minute)
	}
	if attempts > max2FAAttempts {
		// Delete the 2FA token to force re-login
		s.redis.Del(ctx, "2fa:"+req.TwoFaToken)
		s.redis.Del(ctx, attemptsKey)
		return nil, status.Error(codes.ResourceExhausted, "trop de tentatives, reconnectez-vous")
	}

	userID, err := Get2FATokenUserID(ctx, s.redis, req.TwoFaToken)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid or expired 2FA token")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if user.TOTPSecret == nil {
		return nil, status.Error(codes.Internal, "2FA not configured")
	}

	// Accept TOTP or backup code
	valid := ValidateTOTPCode(*user.TOTPSecret, req.Code) || ValidateBackupCode(ctx, s.redis, userID, req.Code)
	if !valid {
		// Re-store the token since Get2FATokenUserID deletes it
		Store2FAToken(ctx, s.redis, req.TwoFaToken, userID)
		return nil, status.Error(codes.InvalidArgument, "invalid 2FA code")
	}

	// Cleanup attempts counter
	s.redis.Del(ctx, attemptsKey)

	return s.generateAuthResponse(ctx, user)
}

// generate2FAChallenge creates a temporary token and returns a challenge response.
func (s *Service) generate2FAChallenge(ctx context.Context, userID string) (*authv1.AuthResponse, error) {
	token := uuid.New().String()
	if err := Store2FAToken(ctx, s.redis, token, userID); err != nil {
		return nil, status.Error(codes.Internal, "failed to create 2FA challenge")
	}

	return &authv1.AuthResponse{
		Requires_2Fa: true,
		TwoFaToken:   token,
	}, nil
}

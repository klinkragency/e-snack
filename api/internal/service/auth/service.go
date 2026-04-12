package auth

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/klinkragency/e-snack/internal/repository"
	"github.com/klinkragency/e-snack/internal/repository/postgres"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	authv1 "github.com/klinkragency/e-snack/gen/auth/v1"
)

type Service struct {
	authv1.UnimplementedAuthServiceServer
	userRepo       repository.UserRepository
	oauthRepo      repository.OAuthAccountRepository
	addressRepo    repository.DeliveryAddressRepository
	otpService     *OTPService
	jwtManager     *JWTManager
	redis          *redis.Client
	googleClientID string
}

func NewService(userRepo repository.UserRepository, oauthRepo repository.OAuthAccountRepository, addressRepo repository.DeliveryAddressRepository, otpService *OTPService, jwtManager *JWTManager, redis *redis.Client, googleClientID string) *Service {
	return &Service{
		userRepo:       userRepo,
		oauthRepo:      oauthRepo,
		addressRepo:    addressRepo,
		otpService:     otpService,
		jwtManager:     jwtManager,
		redis:          redis,
		googleClientID: googleClientID,
	}
}

func (s *Service) Register(ctx context.Context, req *authv1.RegisterRequest) (*authv1.AuthResponse, error) {
	if req.Email == "" || req.Password == "" {
		return nil, status.Error(codes.InvalidArgument, "email and password are required")
	}

	if len(req.Password) < 6 {
		return nil, status.Error(codes.InvalidArgument, "password must be at least 6 characters")
	}

	exists, err := s.userRepo.ExistsByEmail(ctx, req.Email)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to check email")
	}
	if exists {
		return nil, status.Error(codes.AlreadyExists, "email already registered")
	}

	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to hash password")
	}

	var phone *string
	if req.Phone != "" {
		phone = &req.Phone
	}

	user := &repository.User{
		Email:        req.Email,
		PasswordHash: &passwordHash,
		Role:         "client",
		Phone:        phone,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, status.Error(codes.Internal, "failed to create user")
	}

	// Send email verification OTP
	if err := s.otpService.SendEmailVerification(ctx, user.ID, user.Email); err != nil {
		log.Printf("[AUTH] Failed to send verification email to %s: %v", user.Email, err)
	}

	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate tokens")
	}

	s.storeRefreshToken(ctx, user.ID, tokens.RefreshToken)

	return &authv1.AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		User:         s.userToProto(user),
	}, nil
}

const maxFailedLogins = 5

func (s *Service) Login(ctx context.Context, req *authv1.LoginRequest) (*authv1.AuthResponse, error) {
	if req.Email == "" || req.Password == "" {
		return nil, status.Error(codes.InvalidArgument, "email and password are required")
	}

	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.Unauthenticated, "invalid credentials")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	// Check account lock
	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		return nil, status.Error(codes.ResourceExhausted, "compte verrouillé, réessayez plus tard")
	}

	if user.PasswordHash == nil || !CheckPassword(req.Password, *user.PasswordHash) {
		// Track failed attempts
		_ = s.userRepo.IncrementFailedLogins(ctx, user.ID)
		if user.FailedLoginAttempts+1 >= maxFailedLogins {
			_ = s.userRepo.LockAccount(ctx, user.ID, 15*time.Minute)
		}
		return nil, status.Error(codes.Unauthenticated, "invalid credentials")
	}

	// Check if user is banned
	if user.IsBanned {
		return nil, status.Error(codes.PermissionDenied, "compte banni")
	}

	// Reset failed login counter on success
	if user.FailedLoginAttempts > 0 {
		_ = s.userRepo.ResetFailedLogins(ctx, user.ID)
	}

	// If 2FA is enabled, require TOTP verification
	if user.TwoFactorEnabled && user.TOTPSecret != nil {
		if req.TotpCode == "" {
			// No code provided — return 2FA challenge
			return s.generate2FAChallenge(ctx, user.ID)
		}
		// Code provided inline — validate it
		valid := ValidateTOTPCode(*user.TOTPSecret, req.TotpCode) || ValidateBackupCode(ctx, s.redis, user.ID, req.TotpCode)
		if !valid {
			return nil, status.Error(codes.InvalidArgument, "invalid 2FA code")
		}
	}

	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate tokens")
	}

	s.storeRefreshToken(ctx, user.ID, tokens.RefreshToken)

	return &authv1.AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		User:         s.userToProto(user),
	}, nil
}

func (s *Service) RefreshToken(ctx context.Context, req *authv1.RefreshRequest) (*authv1.AuthResponse, error) {
	if req.RefreshToken == "" {
		return nil, status.Error(codes.InvalidArgument, "refresh token is required")
	}

	claims, err := s.jwtManager.ValidateToken(req.RefreshToken)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid refresh token")
	}

	storedToken, err := s.redis.Get(ctx, "refresh:"+claims.UserID).Result()
	if err != nil || storedToken != req.RefreshToken {
		return nil, status.Error(codes.Unauthenticated, "refresh token revoked or expired")
	}

	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if user.IsBanned {
		s.redis.Del(ctx, "refresh:"+user.ID)
		return nil, status.Error(codes.PermissionDenied, "compte banni")
	}

	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate tokens")
	}

	s.storeRefreshToken(ctx, user.ID, tokens.RefreshToken)

	return &authv1.AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		User:         s.userToProto(user),
	}, nil
}

func (s *Service) GetProfile(ctx context.Context, req *authv1.GetProfileRequest) (*authv1.UserProfile, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "user not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToProto(user), nil
}

func (s *Service) storeRefreshToken(ctx context.Context, userID, token string) {
	s.redis.Set(ctx, "refresh:"+userID, token, s.jwtManager.RefreshExpiry())
}

func (s *Service) userToProto(user *repository.User) *authv1.UserProfile {
	profile := &authv1.UserProfile{
		Id:               user.ID,
		Email:            user.Email,
		Role:             user.Role,
		CreatedAt:        timestamppb.New(user.CreatedAt),
		EmailVerified:    user.EmailVerified,
		PhoneVerified:    user.PhoneVerified,
		TwoFactorEnabled: user.TwoFactorEnabled,
	}
	if user.Phone != nil {
		profile.Phone = *user.Phone
	}
	if user.Name != nil {
		profile.Name = *user.Name
	}
	return profile
}

func (s *Service) UpdateProfile(ctx context.Context, req *authv1.UpdateProfileRequest) (*authv1.UserProfile, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	var name, phone *string
	if req.Name != "" {
		name = &req.Name
	}
	if req.Phone != "" {
		phone = &req.Phone
	}

	if err := s.userRepo.UpdateProfile(ctx, userID, name, phone); err != nil {
		return nil, status.Error(codes.Internal, "failed to update profile")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToProto(user), nil
}

func (s *Service) ChangePassword(ctx context.Context, req *authv1.ChangePasswordRequest) (*authv1.ChangePasswordResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		return nil, status.Error(codes.InvalidArgument, "old and new passwords are required")
	}

	if len(req.NewPassword) < 6 {
		return nil, status.Error(codes.InvalidArgument, "new password must be at least 6 characters")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if user.PasswordHash == nil || !CheckPassword(req.OldPassword, *user.PasswordHash) {
		return nil, status.Error(codes.InvalidArgument, "incorrect current password")
	}

	newHash, err := HashPassword(req.NewPassword)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to hash password")
	}

	if err := s.userRepo.UpdatePassword(ctx, userID, newHash); err != nil {
		return nil, status.Error(codes.Internal, "failed to update password")
	}

	// Revoke all existing sessions
	s.redis.Del(ctx, "refresh:"+userID)

	return &authv1.ChangePasswordResponse{
		Success: true,
		Message: "Password changed successfully",
	}, nil
}

func (s *Service) OAuthLogin(ctx context.Context, req *authv1.OAuthLoginRequest) (*authv1.AuthResponse, error) {
	if req.Provider == "" || req.IdToken == "" {
		return nil, status.Error(codes.InvalidArgument, "provider and id_token are required")
	}

	// 1. Verify the ID token with the provider
	claims, err := verifyOAuthToken(req.Provider, req.IdToken, s.googleClientID)
	if err != nil {
		if errors.Is(err, ErrUnsupportedProvider) {
			return nil, status.Error(codes.InvalidArgument, "unsupported OAuth provider")
		}
		return nil, status.Error(codes.Unauthenticated, "invalid OAuth token")
	}

	// 2. Check if OAuth account already exists → login
	oauthAccount, err := s.oauthRepo.GetByProvider(ctx, claims.Provider, claims.Sub)
	if err == nil {
		// Existing OAuth account — login the linked user
		user, err := s.userRepo.GetByID(ctx, oauthAccount.UserID)
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to get user")
		}
		// Ensure email is marked verified (OAuth provider already confirmed it)
		if !user.EmailVerified {
			_ = s.userRepo.MarkEmailVerified(ctx, user.ID)
			user.EmailVerified = true
		}
		return s.generateAuthResponse(ctx, user)
	}
	if !errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.Internal, "failed to check OAuth account")
	}

	// 3. No OAuth account — check if a user with this email exists → link
	if claims.Email != "" {
		existingUser, err := s.userRepo.GetByEmail(ctx, claims.Email)
		if err == nil {
			// Link OAuth account to existing user
			if err := s.oauthRepo.Create(ctx, &repository.OAuthAccount{
				UserID:         existingUser.ID,
				Provider:       claims.Provider,
				ProviderUserID: claims.Sub,
				Email:          claims.Email,
			}); err != nil {
				return nil, status.Error(codes.Internal, "failed to link OAuth account")
			}
			// Mark email as verified since the OAuth provider confirmed it
			if !existingUser.EmailVerified {
				_ = s.userRepo.MarkEmailVerified(ctx, existingUser.ID)
			}
			return s.generateAuthResponse(ctx, existingUser)
		}
		if !errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.Internal, "failed to check user email")
		}
	}

	// 4. No user at all — create new user + OAuth account
	// Email is considered verified since the OAuth provider already confirmed it
	user := &repository.User{
		Email:         claims.Email,
		Role:          "client",
		EmailVerified: true,
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, status.Error(codes.Internal, "failed to create user")
	}

	if err := s.oauthRepo.Create(ctx, &repository.OAuthAccount{
		UserID:         user.ID,
		Provider:       claims.Provider,
		ProviderUserID: claims.Sub,
		Email:          claims.Email,
	}); err != nil {
		return nil, status.Error(codes.Internal, "failed to create OAuth account")
	}

	return s.generateAuthResponse(ctx, user)
}

func (s *Service) generateAuthResponse(ctx context.Context, user *repository.User) (*authv1.AuthResponse, error) {
	tokens, err := s.jwtManager.GenerateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to generate tokens")
	}

	s.storeRefreshToken(ctx, user.ID, tokens.RefreshToken)

	return &authv1.AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		User:         s.userToProto(user),
	}, nil
}

func (s *Service) SendEmailVerification(ctx context.Context, req *authv1.SendEmailVerificationRequest) (*authv1.VerificationResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	if user.EmailVerified {
		return &authv1.VerificationResponse{
			Success: false,
			Message: "Email already verified",
		}, nil
	}

	if err := s.otpService.SendEmailVerification(ctx, userID, user.Email); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &authv1.VerificationResponse{
		Success: true,
		Message: "Verification code sent to your email",
	}, nil
}

func (s *Service) VerifyEmail(ctx context.Context, req *authv1.VerifyEmailRequest) (*authv1.VerificationResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "code is required")
	}

	if err := s.otpService.VerifyEmailCode(ctx, userID, req.Code); err != nil {
		return &authv1.VerificationResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &authv1.VerificationResponse{
		Success: true,
		Message: "Email verified successfully",
	}, nil
}

func (s *Service) ForgotPassword(ctx context.Context, req *authv1.ForgotPasswordRequest) (*authv1.PasswordResetResponse, error) {
	if req.Email == "" {
		return nil, status.Error(codes.InvalidArgument, "email is required")
	}

	// Always return success to prevent email enumeration
	if err := s.otpService.SendPasswordReset(ctx, req.Email); err != nil {
		// Log error but return success
	}

	return &authv1.PasswordResetResponse{
		Success: true,
		Message: "If this email exists, a verification code has been sent",
	}, nil
}

func (s *Service) VerifyResetCode(ctx context.Context, req *authv1.VerifyResetCodeRequest) (*authv1.PasswordResetResponse, error) {
	if req.Email == "" || req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "email and code are required")
	}

	resetToken, err := s.otpService.VerifyPasswordResetCode(ctx, req.Email, req.Code)
	if err != nil {
		return &authv1.PasswordResetResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &authv1.PasswordResetResponse{
		Success:    true,
		Message:    "Code verified successfully",
		ResetToken: resetToken,
	}, nil
}

func (s *Service) ResetPassword(ctx context.Context, req *authv1.ResetPasswordRequest) (*authv1.PasswordResetResponse, error) {
	if req.ResetToken == "" || req.NewPassword == "" {
		return nil, status.Error(codes.InvalidArgument, "reset_token and new_password are required")
	}

	if len(req.NewPassword) < 6 {
		return nil, status.Error(codes.InvalidArgument, "password must be at least 6 characters")
	}

	if err := s.otpService.ResetPassword(ctx, req.ResetToken, req.NewPassword); err != nil {
		return &authv1.PasswordResetResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &authv1.PasswordResetResponse{
		Success: true,
		Message: "Password reset successfully",
	}, nil
}

type contextKey string

const UserIDKey contextKey = "user_id"
const UserRoleKey contextKey = "user_role"

// ==================== Admin User Management ====================

func (s *Service) AdminListUsers(ctx context.Context, req *authv1.AdminListUsersRequest) (*authv1.AdminListUsersResponse, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	page := int(req.Page)
	if page < 1 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	users, total, err := s.userRepo.List(ctx, page, pageSize, req.Role)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list users")
	}

	adminUsers := make([]*authv1.AdminUser, 0, len(users))
	for _, u := range users {
		adminUsers = append(adminUsers, s.userToAdminProto(u))
	}

	return &authv1.AdminListUsersResponse{
		Users: adminUsers,
		Total: int32(total),
	}, nil
}

func (s *Service) AdminGetUser(ctx context.Context, req *authv1.AdminGetUserRequest) (*authv1.AdminUser, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	user, err := s.userRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "user not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToAdminProto(user), nil
}

func (s *Service) AdminUpdateUser(ctx context.Context, req *authv1.AdminUpdateUserRequest) (*authv1.AdminUser, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	if req.Role != "" {
		if err := s.userRepo.UpdateRole(ctx, req.Id, req.Role); err != nil {
			if errors.Is(err, postgres.ErrNotFound) {
				return nil, status.Error(codes.NotFound, "user not found")
			}
			return nil, status.Error(codes.Internal, "failed to update role")
		}
	}

	var name, phone *string
	if req.Name != "" {
		name = &req.Name
	}
	if req.Phone != "" {
		phone = &req.Phone
	}
	if name != nil || phone != nil {
		if err := s.userRepo.UpdateProfile(ctx, req.Id, name, phone); err != nil {
			return nil, status.Error(codes.Internal, "failed to update profile")
		}
	}

	user, err := s.userRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToAdminProto(user), nil
}

func (s *Service) AdminDeleteUser(ctx context.Context, req *authv1.AdminDeleteUserRequest) (*authv1.AdminDeleteUserResponse, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	if err := s.userRepo.Delete(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "user not found")
		}
		return nil, status.Error(codes.Internal, "failed to delete user")
	}

	return &authv1.AdminDeleteUserResponse{Success: true}, nil
}

func (s *Service) AdminBanUser(ctx context.Context, req *authv1.AdminBanUserRequest) (*authv1.AdminUser, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	if err := s.userRepo.Ban(ctx, req.Id, req.Reason); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "user not found")
		}
		return nil, status.Error(codes.Internal, "failed to ban user")
	}

	// Revoke all sessions for banned user
	s.redis.Del(ctx, "refresh:"+req.Id)

	user, err := s.userRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToAdminProto(user), nil
}

func (s *Service) AdminUnbanUser(ctx context.Context, req *authv1.AdminUnbanUserRequest) (*authv1.AdminUser, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	if err := s.userRepo.Unban(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "user not found")
		}
		return nil, status.Error(codes.Internal, "failed to unban user")
	}

	user, err := s.userRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToAdminProto(user), nil
}

func (s *Service) AdminVerifyUserEmail(ctx context.Context, req *authv1.AdminVerifyUserEmailRequest) (*authv1.AdminUser, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	if err := s.userRepo.MarkEmailVerified(ctx, req.Id); err != nil {
		return nil, status.Error(codes.Internal, "failed to verify email")
	}

	user, err := s.userRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToAdminProto(user), nil
}

func (s *Service) AdminToggleUser2FA(ctx context.Context, req *authv1.AdminToggleUser2FARequest) (*authv1.AdminUser, error) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || role != "admin" {
		return nil, status.Error(codes.PermissionDenied, "admin access required")
	}

	switch req.Endpoint {
	case "enable":
		if err := s.userRepo.Enable2FA(ctx, req.Id); err != nil {
			return nil, status.Error(codes.Internal, "failed to enable 2FA")
		}
	case "disable":
		if err := s.userRepo.Disable2FA(ctx, req.Id); err != nil {
			return nil, status.Error(codes.Internal, "failed to disable 2FA")
		}
	default:
		return nil, status.Error(codes.InvalidArgument, "endpoint must be 'enable' or 'disable'")
	}

	user, err := s.userRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user")
	}

	return s.userToAdminProto(user), nil
}

func (s *Service) userToAdminProto(user *repository.User) *authv1.AdminUser {
	adminUser := &authv1.AdminUser{
		Id:               user.ID,
		Email:            user.Email,
		Role:             user.Role,
		EmailVerified:    user.EmailVerified,
		TwoFactorEnabled: user.TwoFactorEnabled,
		IsBanned:         user.IsBanned,
		CreatedAt:        timestamppb.New(user.CreatedAt),
	}
	if user.Name != nil {
		adminUser.Name = *user.Name
	}
	if user.Phone != nil {
		adminUser.Phone = *user.Phone
	}
	if user.BannedAt != nil {
		adminUser.BannedAt = timestamppb.New(*user.BannedAt)
	}
	if user.BanReason != nil {
		adminUser.BanReason = *user.BanReason
	}
	if user.LastLoginAt != nil {
		adminUser.LastLoginAt = timestamppb.New(*user.LastLoginAt)
	}
	return adminUser
}

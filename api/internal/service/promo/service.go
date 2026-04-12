package promo

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/beldys/api/internal/repository"
	"github.com/beldys/api/internal/repository/postgres"
	"github.com/beldys/api/internal/service/auth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	promov1 "github.com/beldys/api/gen/promo/v1"
)

type Service struct {
	promov1.UnimplementedPromoServiceServer
	promoRepo     repository.PromoCodeRepository
	userPromoRepo repository.UserPromoCodeRepository
	orderRepo     repository.OrderRepository
}

func NewService(promoRepo repository.PromoCodeRepository, userPromoRepo repository.UserPromoCodeRepository, orderRepo repository.OrderRepository) *Service {
	return &Service{
		promoRepo:     promoRepo,
		userPromoRepo: userPromoRepo,
		orderRepo:     orderRepo,
	}
}

// ==================== Admin Methods ====================

func (s *Service) CreatePromo(ctx context.Context, req *promov1.CreatePromoRequest) (*promov1.PromoCode, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "code is required")
	}

	if req.DiscountType == "" {
		return nil, status.Error(codes.InvalidArgument, "discount_type is required")
	}

	validTypes := map[string]bool{"percentage": true, "fixed_amount": true, "free_delivery": true}
	if !validTypes[req.DiscountType] {
		return nil, status.Error(codes.InvalidArgument, "discount_type must be percentage, fixed_amount, or free_delivery")
	}

	if req.DiscountType != "free_delivery" && req.DiscountValue <= 0 {
		return nil, status.Error(codes.InvalidArgument, "discount_value must be positive")
	}

	if req.DiscountType == "percentage" && req.DiscountValue > 100 {
		return nil, status.Error(codes.InvalidArgument, "percentage discount cannot exceed 100")
	}

	// Check if code already exists
	_, err := s.promoRepo.GetByCode(ctx, req.Code)
	if err == nil {
		return nil, status.Error(codes.AlreadyExists, "promo code already exists")
	}
	if !errors.Is(err, postgres.ErrPromoNotFound) {
		return nil, status.Error(codes.Internal, "failed to check code uniqueness")
	}

	promo := &repository.PromoCode{
		Code:           strings.ToUpper(req.Code),
		DiscountType:   req.DiscountType,
		DiscountValue:  req.DiscountValue,
		MaxUsesPerUser: 1,
		FirstOrderOnly: req.FirstOrderOnly,
		IsActive:       true,
		StartsAt:       time.Now(),
		RestaurantIDs:  req.RestaurantIds,
		IsPrivate:      req.IsPrivate,
		RequiresClaim:  req.RequiresClaim,
	}

	if req.MinOrderAmount > 0 {
		promo.MinOrderAmount = &req.MinOrderAmount
	}
	if req.MaxDiscountAmount > 0 {
		promo.MaxDiscountAmount = &req.MaxDiscountAmount
	}
	if req.MaxTotalUses > 0 {
		maxUses := int(req.MaxTotalUses)
		promo.MaxTotalUses = &maxUses
	}
	if req.MaxUsesPerUser > 0 {
		promo.MaxUsesPerUser = int(req.MaxUsesPerUser)
	}
	if req.StartsAt != nil {
		promo.StartsAt = req.StartsAt.AsTime()
	}
	if req.ExpiresAt != nil {
		expiresAt := req.ExpiresAt.AsTime()
		promo.ExpiresAt = &expiresAt
	}
	if req.Description != "" {
		promo.Description = &req.Description
	}

	if err := s.promoRepo.Create(ctx, promo); err != nil {
		return nil, status.Error(codes.Internal, "failed to create promo code")
	}

	return s.toProto(promo), nil
}

func (s *Service) ListPromos(ctx context.Context, req *promov1.ListPromosRequest) (*promov1.ListPromosResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	page := int(req.Page)
	if page < 1 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	promos, total, err := s.promoRepo.List(ctx, page, pageSize, req.Search, req.ActiveOnly, req.TypeFilter)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list promo codes")
	}

	protoPromos := make([]*promov1.PromoCode, len(promos))
	for i, p := range promos {
		protoPromos[i] = s.toProto(p)
	}

	return &promov1.ListPromosResponse{
		Promos:   protoPromos,
		Total:    int32(total),
		Page:     int32(page),
		PageSize: int32(pageSize),
	}, nil
}

func (s *Service) GetPromo(ctx context.Context, req *promov1.GetPromoRequest) (*promov1.PromoCode, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	promo, err := s.promoRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrPromoNotFound) {
		return nil, status.Error(codes.NotFound, "promo code not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo code")
	}

	return s.toProto(promo), nil
}

func (s *Service) UpdatePromo(ctx context.Context, req *promov1.UpdatePromoRequest) (*promov1.PromoCode, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	promo, err := s.promoRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrPromoNotFound) {
		return nil, status.Error(codes.NotFound, "promo code not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo code")
	}

	// Update fields if provided
	if req.Code != "" {
		promo.Code = strings.ToUpper(req.Code)
	}
	if req.DiscountType != "" {
		validTypes := map[string]bool{"percentage": true, "fixed_amount": true, "free_delivery": true}
		if !validTypes[req.DiscountType] {
			return nil, status.Error(codes.InvalidArgument, "invalid discount_type")
		}
		promo.DiscountType = req.DiscountType
	}
	if req.DiscountValue > 0 {
		promo.DiscountValue = req.DiscountValue
	}
	if req.MinOrderAmount >= 0 {
		if req.MinOrderAmount == 0 {
			promo.MinOrderAmount = nil
		} else {
			promo.MinOrderAmount = &req.MinOrderAmount
		}
	}
	if req.MaxDiscountAmount >= 0 {
		if req.MaxDiscountAmount == 0 {
			promo.MaxDiscountAmount = nil
		} else {
			promo.MaxDiscountAmount = &req.MaxDiscountAmount
		}
	}
	if req.MaxTotalUses >= 0 {
		if req.MaxTotalUses == 0 {
			promo.MaxTotalUses = nil
		} else {
			maxUses := int(req.MaxTotalUses)
			promo.MaxTotalUses = &maxUses
		}
	}
	if req.MaxUsesPerUser > 0 {
		promo.MaxUsesPerUser = int(req.MaxUsesPerUser)
	}
	promo.FirstOrderOnly = req.FirstOrderOnly
	promo.IsActive = req.IsActive
	promo.IsPrivate = req.IsPrivate
	promo.RequiresClaim = req.RequiresClaim
	if req.StartsAt != nil {
		promo.StartsAt = req.StartsAt.AsTime()
	}
	if req.ExpiresAt != nil {
		expiresAt := req.ExpiresAt.AsTime()
		promo.ExpiresAt = &expiresAt
	}
	if req.Description != "" {
		promo.Description = &req.Description
	}
	promo.RestaurantIDs = req.RestaurantIds

	if err := s.promoRepo.Update(ctx, promo); err != nil {
		return nil, status.Error(codes.Internal, "failed to update promo code")
	}

	return s.toProto(promo), nil
}

func (s *Service) DeletePromo(ctx context.Context, req *promov1.DeletePromoRequest) (*promov1.DeletePromoResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	err := s.promoRepo.Delete(ctx, req.Id)
	if errors.Is(err, postgres.ErrPromoNotFound) {
		return nil, status.Error(codes.NotFound, "promo code not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to delete promo code")
	}

	return &promov1.DeletePromoResponse{Success: true}, nil
}

func (s *Service) GetPromoUsage(ctx context.Context, req *promov1.GetPromoUsageRequest) (*promov1.GetPromoUsageResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	page := int(req.Page)
	if page < 1 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	usages, total, err := s.promoRepo.GetUsageByPromo(ctx, req.Id, page, pageSize)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get usage history")
	}

	totalDiscount, err := s.promoRepo.GetTotalDiscountByPromo(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get total discount")
	}

	protoUsages := make([]*promov1.PromoUsage, len(usages))
	for i, u := range usages {
		protoUsages[i] = &promov1.PromoUsage{
			Id:              u.ID,
			PromoCodeId:     u.PromoCodeID,
			UserId:          u.UserID,
			UserEmail:       u.UserEmail,
			DiscountApplied: u.DiscountApplied,
			Source:          u.Source,
			CreatedAt:       timestamppb.New(u.CreatedAt),
		}
		if u.OrderID != nil {
			protoUsages[i].OrderId = *u.OrderID
		}
	}

	return &promov1.GetPromoUsageResponse{
		Usage:              protoUsages,
		Total:              int32(total),
		Page:               int32(page),
		PageSize:           int32(pageSize),
		TotalDiscountGiven: totalDiscount,
	}, nil
}

func (s *Service) GetPromoStats(ctx context.Context, req *promov1.GetPromoStatsRequest) (*promov1.GetPromoStatsResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	stats, err := s.promoRepo.GetStats(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo stats")
	}

	return &promov1.GetPromoStatsResponse{
		TotalAssignments:   int32(stats.TotalAssignments),
		ClaimedCount:       int32(stats.ClaimedCount),
		UsedCount:          int32(stats.UsedCount),
		RevokedCount:       int32(stats.RevokedCount),
		ExpiredCount:       int32(stats.ExpiredCount),
		TotalDiscountGiven: stats.TotalDiscountGiven,
		AverageDiscount:    stats.AverageDiscount,
		UniqueUsers:        int32(stats.UniqueUsers),
	}, nil
}

// ==================== User Assignment Methods ====================

func (s *Service) AssignPromoToUser(ctx context.Context, req *promov1.AssignPromoToUserRequest) (*promov1.UserPromoCode, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	adminID, _ := s.getUserID(ctx)

	if req.PromoId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "promo_id and user_id are required")
	}

	// Check promo exists
	promo, err := s.promoRepo.GetByID(ctx, req.PromoId)
	if errors.Is(err, postgres.ErrPromoNotFound) {
		return nil, status.Error(codes.NotFound, "promo code not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo code")
	}

	// Check if already assigned
	existing, _ := s.userPromoRepo.GetByPromoAndUser(ctx, req.PromoId, req.UserId)
	if existing != nil {
		return nil, status.Error(codes.AlreadyExists, "promo already assigned to user")
	}

	upc := &repository.UserPromoCode{
		PromoCodeID: req.PromoId,
		UserID:      req.UserId,
		Status:      "assigned",
		AssignedBy:  &adminID,
		AssignedAt:  time.Now(),
	}

	if req.ExpiresAt != nil {
		expiresAt := req.ExpiresAt.AsTime()
		upc.ExpiresAt = &expiresAt
	}
	if req.Notes != "" {
		upc.Notes = &req.Notes
	}

	if err := s.userPromoRepo.Create(ctx, upc); err != nil {
		return nil, status.Error(codes.Internal, "failed to assign promo")
	}

	// Reload with user info
	upc, _ = s.userPromoRepo.GetByID(ctx, upc.ID)

	return s.userPromoToProto(upc, promo), nil
}

func (s *Service) AssignPromoToUsers(ctx context.Context, req *promov1.AssignPromoToUsersRequest) (*promov1.AssignPromoToUsersResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	adminID, _ := s.getUserID(ctx)

	if req.PromoId == "" || len(req.UserIds) == 0 {
		return nil, status.Error(codes.InvalidArgument, "promo_id and user_ids are required")
	}

	// Check promo exists
	_, err := s.promoRepo.GetByID(ctx, req.PromoId)
	if errors.Is(err, postgres.ErrPromoNotFound) {
		return nil, status.Error(codes.NotFound, "promo code not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo code")
	}

	var successCount, failedCount int
	var failedUserIDs, failedReasons []string

	for _, userID := range req.UserIds {
		// Check if already assigned
		existing, _ := s.userPromoRepo.GetByPromoAndUser(ctx, req.PromoId, userID)
		if existing != nil {
			failedCount++
			failedUserIDs = append(failedUserIDs, userID)
			failedReasons = append(failedReasons, "already assigned")
			continue
		}

		upc := &repository.UserPromoCode{
			PromoCodeID: req.PromoId,
			UserID:      userID,
			Status:      "assigned",
			AssignedBy:  &adminID,
			AssignedAt:  time.Now(),
		}

		if req.ExpiresAt != nil {
			expiresAt := req.ExpiresAt.AsTime()
			upc.ExpiresAt = &expiresAt
		}
		if req.Notes != "" {
			upc.Notes = &req.Notes
		}

		if err := s.userPromoRepo.Create(ctx, upc); err != nil {
			failedCount++
			failedUserIDs = append(failedUserIDs, userID)
			failedReasons = append(failedReasons, "creation failed")
			continue
		}

		successCount++
	}

	return &promov1.AssignPromoToUsersResponse{
		SuccessCount:  int32(successCount),
		FailedCount:   int32(failedCount),
		FailedUserIds: failedUserIDs,
		FailedReasons: failedReasons,
	}, nil
}

func (s *Service) RevokeUserPromo(ctx context.Context, req *promov1.RevokeUserPromoRequest) (*promov1.UserPromoCode, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	adminID, _ := s.getUserID(ctx)

	if req.PromoId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "promo_id and user_id are required")
	}

	upc, err := s.userPromoRepo.GetByPromoAndUser(ctx, req.PromoId, req.UserId)
	if errors.Is(err, postgres.ErrUserPromoNotFound) {
		return nil, status.Error(codes.NotFound, "user promo assignment not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get user promo")
	}

	if upc.Status == "revoked" {
		return nil, status.Error(codes.FailedPrecondition, "promo already revoked")
	}
	if upc.Status == "used" {
		return nil, status.Error(codes.FailedPrecondition, "cannot revoke used promo")
	}

	if err := s.userPromoRepo.Revoke(ctx, upc.ID, adminID, req.Reason); err != nil {
		return nil, status.Error(codes.Internal, "failed to revoke promo")
	}

	// Reload
	upc, _ = s.userPromoRepo.GetByID(ctx, upc.ID)
	promo, _ := s.promoRepo.GetByID(ctx, req.PromoId)

	return s.userPromoToProto(upc, promo), nil
}

func (s *Service) ListPromoAssignments(ctx context.Context, req *promov1.ListPromoAssignmentsRequest) (*promov1.ListPromoAssignmentsResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.PromoId == "" {
		return nil, status.Error(codes.InvalidArgument, "promo_id is required")
	}

	page := int(req.Page)
	if page < 1 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	assignments, total, err := s.userPromoRepo.ListByPromo(ctx, req.PromoId, page, pageSize, req.StatusFilter)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list assignments")
	}

	promo, _ := s.promoRepo.GetByID(ctx, req.PromoId)

	protoAssignments := make([]*promov1.UserPromoCode, len(assignments))
	for i, a := range assignments {
		protoAssignments[i] = s.userPromoToProto(a, promo)
	}

	return &promov1.ListPromoAssignmentsResponse{
		Assignments: protoAssignments,
		Total:       int32(total),
		Page:        int32(page),
		PageSize:    int32(pageSize),
	}, nil
}

func (s *Service) GetPromoAssignment(ctx context.Context, req *promov1.GetPromoAssignmentRequest) (*promov1.UserPromoCode, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.PromoId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "promo_id and user_id are required")
	}

	upc, err := s.userPromoRepo.GetByPromoAndUser(ctx, req.PromoId, req.UserId)
	if errors.Is(err, postgres.ErrUserPromoNotFound) {
		return nil, status.Error(codes.NotFound, "assignment not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get assignment")
	}

	promo, _ := s.promoRepo.GetByID(ctx, req.PromoId)

	return s.userPromoToProto(upc, promo), nil
}

// ==================== Client Methods ====================

func (s *Service) ValidatePromo(ctx context.Context, req *promov1.ValidatePromoRequest) (*promov1.ValidatePromoResponse, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	if req.Code == "" {
		return &promov1.ValidatePromoResponse{
			Valid:        false,
			ErrorMessage: "Code promo requis",
		}, nil
	}

	promo, err := s.promoRepo.GetByCode(ctx, req.Code)
	if errors.Is(err, postgres.ErrPromoNotFound) {
		return &promov1.ValidatePromoResponse{
			Valid:        false,
			ErrorMessage: "Code promo invalide",
		}, nil
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo code")
	}

	// Check private code access
	var userPromo *repository.UserPromoCode
	if promo.IsPrivate {
		userPromo, err = s.userPromoRepo.GetByPromoAndUser(ctx, promo.ID, userID)
		if errors.Is(err, postgres.ErrUserPromoNotFound) {
			return &promov1.ValidatePromoResponse{
				Valid:        false,
				ErrorMessage: "Ce code promo ne vous est pas attribué",
			}, nil
		}
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to check user promo")
		}

		// Check user promo status
		if userPromo.Status == "revoked" {
			return &promov1.ValidatePromoResponse{
				Valid:        false,
				ErrorMessage: "Ce code promo a été révoqué",
			}, nil
		}
		if userPromo.Status == "used" {
			return &promov1.ValidatePromoResponse{
				Valid:        false,
				ErrorMessage: "Ce code promo a déjà été utilisé",
			}, nil
		}
		if userPromo.Status == "expired" {
			return &promov1.ValidatePromoResponse{
				Valid:        false,
				ErrorMessage: "Ce code promo a expiré",
			}, nil
		}
		// Check per-user expiration
		if userPromo.ExpiresAt != nil && time.Now().After(*userPromo.ExpiresAt) {
			return &promov1.ValidatePromoResponse{
				Valid:        false,
				ErrorMessage: "Ce code promo a expiré",
			}, nil
		}
	}

	// Check if claim is required
	requiresClaim := promo.RequiresClaim
	isClaimed := false
	if requiresClaim {
		if userPromo == nil {
			userPromo, _ = s.userPromoRepo.GetByPromoAndUser(ctx, promo.ID, userID)
		}
		if userPromo != nil && (userPromo.Status == "claimed" || userPromo.Status == "used") {
			isClaimed = true
		}
		if !isClaimed {
			return &promov1.ValidatePromoResponse{
				Valid:         false,
				ErrorMessage:  "Vous devez d'abord réclamer ce code promo",
				RequiresClaim: true,
				IsClaimed:     false,
				Promo:         s.toProto(promo),
			}, nil
		}
	}

	// Standard validation checks
	errorMsg := s.validatePromoForUser(ctx, promo, userID, req.RestaurantId, req.Subtotal)
	if errorMsg != "" {
		return &promov1.ValidatePromoResponse{
			Valid:        false,
			ErrorMessage: errorMsg,
		}, nil
	}

	// Calculate discount
	discount := s.calculateDiscount(promo, req.Subtotal, req.DeliveryFee)

	return &promov1.ValidatePromoResponse{
		Valid:          true,
		Promo:          s.toProto(promo),
		DiscountAmount: discount,
		RequiresClaim:  requiresClaim,
		IsClaimed:      isClaimed,
	}, nil
}

func (s *Service) ClaimPromo(ctx context.Context, req *promov1.ClaimPromoRequest) (*promov1.ClaimPromoResponse, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	if req.Code == "" && req.PromoId == "" {
		return &promov1.ClaimPromoResponse{
			Success:      false,
			ErrorMessage: "Code ou promo_id requis",
		}, nil
	}

	var promo *repository.PromoCode
	if req.PromoId != "" {
		promo, err = s.promoRepo.GetByID(ctx, req.PromoId)
	} else {
		promo, err = s.promoRepo.GetByCode(ctx, req.Code)
	}

	if errors.Is(err, postgres.ErrPromoNotFound) {
		return &promov1.ClaimPromoResponse{
			Success:      false,
			ErrorMessage: "Code promo invalide",
		}, nil
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo code")
	}

	// Check if promo is active and valid
	if !promo.IsActive {
		return &promov1.ClaimPromoResponse{
			Success:      false,
			ErrorMessage: "Ce code promo n'est plus actif",
		}, nil
	}

	now := time.Now()
	if now.Before(promo.StartsAt) {
		return &promov1.ClaimPromoResponse{
			Success:      false,
			ErrorMessage: "Ce code promo n'est pas encore valide",
		}, nil
	}
	if promo.ExpiresAt != nil && now.After(*promo.ExpiresAt) {
		return &promov1.ClaimPromoResponse{
			Success:      false,
			ErrorMessage: "Ce code promo a expiré",
		}, nil
	}

	// Check if user already has this promo
	userPromo, err := s.userPromoRepo.GetByPromoAndUser(ctx, promo.ID, userID)
	if err != nil && !errors.Is(err, postgres.ErrUserPromoNotFound) {
		return nil, status.Error(codes.Internal, "failed to check user promo")
	}

	if userPromo != nil {
		// Already exists
		if userPromo.Status == "claimed" || userPromo.Status == "used" {
			return &promov1.ClaimPromoResponse{
				Success:      false,
				ErrorMessage: "Vous avez déjà réclamé ce code promo",
				UserPromo:    s.userPromoToProto(userPromo, promo),
			}, nil
		}
		if userPromo.Status == "revoked" {
			return &promov1.ClaimPromoResponse{
				Success:      false,
				ErrorMessage: "Ce code promo a été révoqué",
			}, nil
		}
		if userPromo.Status == "assigned" {
			// Claim it
			if err := s.userPromoRepo.Claim(ctx, userPromo.ID); err != nil {
				return nil, status.Error(codes.Internal, "failed to claim promo")
			}
			userPromo, _ = s.userPromoRepo.GetByID(ctx, userPromo.ID)
			return &promov1.ClaimPromoResponse{
				Success:   true,
				UserPromo: s.userPromoToProto(userPromo, promo),
			}, nil
		}
	}

	// For public promos with requires_claim, create the user_promo_code entry
	if !promo.IsPrivate && promo.RequiresClaim {
		upc := &repository.UserPromoCode{
			PromoCodeID: promo.ID,
			UserID:      userID,
			Status:      "claimed",
			AssignedAt:  now,
		}
		claimedAt := now
		upc.ClaimedAt = &claimedAt

		if err := s.userPromoRepo.Create(ctx, upc); err != nil {
			// Check if duplicate
			if strings.Contains(err.Error(), "duplicate") {
				return &promov1.ClaimPromoResponse{
					Success:      false,
					ErrorMessage: "Vous avez déjà réclamé ce code promo",
				}, nil
			}
			return nil, status.Error(codes.Internal, "failed to claim promo")
		}

		upc, _ = s.userPromoRepo.GetByID(ctx, upc.ID)
		return &promov1.ClaimPromoResponse{
			Success:   true,
			UserPromo: s.userPromoToProto(upc, promo),
		}, nil
	}

	// Private promo but not assigned to user
	if promo.IsPrivate {
		return &promov1.ClaimPromoResponse{
			Success:      false,
			ErrorMessage: "Ce code promo ne vous est pas attribué",
		}, nil
	}

	// Public promo without requires_claim - no need to claim
	return &promov1.ClaimPromoResponse{
		Success:      false,
		ErrorMessage: "Ce code promo ne nécessite pas de réclamation",
	}, nil
}

func (s *Service) ListMyPromos(ctx context.Context, req *promov1.ListMyPromosRequest) (*promov1.ListMyPromosResponse, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	page := int(req.Page)
	if page < 1 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// Map status filter for user-friendly terms
	statusFilter := req.StatusFilter
	if statusFilter == "available" {
		statusFilter = "claimed" // Available = claimed but not used
	}

	promos, total, err := s.userPromoRepo.ListByUser(ctx, userID, page, pageSize, statusFilter)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list user promos")
	}

	protoPromos := make([]*promov1.UserPromoCode, len(promos))
	for i, upc := range promos {
		protoPromos[i] = s.userPromoToProto(upc, upc.Promo)
	}

	return &promov1.ListMyPromosResponse{
		Promos:   protoPromos,
		Total:    int32(total),
		Page:     int32(page),
		PageSize: int32(pageSize),
	}, nil
}

func (s *Service) GetMyPromo(ctx context.Context, req *promov1.GetMyPromoRequest) (*promov1.UserPromoCode, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	upc, err := s.userPromoRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrUserPromoNotFound) {
		return nil, status.Error(codes.NotFound, "promo not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get promo")
	}

	// Verify ownership
	if upc.UserID != userID {
		return nil, status.Error(codes.PermissionDenied, "not your promo")
	}

	return s.userPromoToProto(upc, upc.Promo), nil
}

func (s *Service) RecordPromoUsage(ctx context.Context, req *promov1.RecordPromoUsageRequest) (*promov1.RecordPromoUsageResponse, error) {
	usage := &repository.PromoUsage{
		PromoCodeID:     req.PromoCodeId,
		UserID:          req.UserId,
		DiscountApplied: req.DiscountApplied,
		Source:          req.Source,
	}
	if req.OrderId != "" {
		usage.OrderID = &req.OrderId
	}
	if req.UserPromoCodeId != "" {
		usage.UserPromoCodeID = &req.UserPromoCodeId
	}

	if err := s.promoRepo.RecordUsage(ctx, usage); err != nil {
		return nil, status.Error(codes.Internal, "failed to record usage")
	}

	if err := s.promoRepo.IncrementUses(ctx, req.PromoCodeId); err != nil {
		return nil, status.Error(codes.Internal, "failed to increment uses")
	}

	// If user promo code provided, mark it as used
	if req.UserPromoCodeId != "" && req.OrderId != "" {
		if err := s.userPromoRepo.MarkUsed(ctx, req.UserPromoCodeId, req.OrderId); err != nil {
			// Log but don't fail - usage already recorded
		}
	}

	return &promov1.RecordPromoUsageResponse{Success: true}, nil
}

// ==================== Helper Methods ====================

func (s *Service) validatePromoForUser(ctx context.Context, promo *repository.PromoCode, userID, restaurantID string, subtotal float64) string {
	now := time.Now()

	// Check active
	if !promo.IsActive {
		return "Ce code promo n'est plus actif"
	}

	// Check dates
	if now.Before(promo.StartsAt) {
		return "Ce code promo n'est pas encore valide"
	}
	if promo.ExpiresAt != nil && now.After(*promo.ExpiresAt) {
		return "Ce code promo a expiré"
	}

	// Check total uses
	if promo.MaxTotalUses != nil && promo.CurrentUses >= *promo.MaxTotalUses {
		return "Ce code promo a atteint sa limite d'utilisation"
	}

	// Check user uses
	userUses, err := s.promoRepo.CountUsageByUser(ctx, promo.ID, userID)
	if err == nil && userUses >= promo.MaxUsesPerUser {
		return "Vous avez déjà utilisé ce code promo"
	}

	// Check minimum order
	if promo.MinOrderAmount != nil && subtotal < *promo.MinOrderAmount {
		return "Le montant minimum de commande n'est pas atteint"
	}

	// Check restaurant restriction
	if len(promo.RestaurantIDs) > 0 {
		found := false
		for _, rid := range promo.RestaurantIDs {
			if rid == restaurantID {
				found = true
				break
			}
		}
		if !found {
			return "Ce code promo n'est pas valide pour ce restaurant"
		}
	}

	// Check first order only
	if promo.FirstOrderOnly {
		orderCount, err := s.orderRepo.CountByUser(ctx, userID)
		if err == nil && orderCount > 0 {
			return "Ce code promo est réservé aux nouvelles commandes"
		}
	}

	return ""
}

func (s *Service) calculateDiscount(promo *repository.PromoCode, subtotal, deliveryFee float64) float64 {
	var discount float64

	switch promo.DiscountType {
	case "percentage":
		discount = subtotal * (promo.DiscountValue / 100)
		if promo.MaxDiscountAmount != nil && discount > *promo.MaxDiscountAmount {
			discount = *promo.MaxDiscountAmount
		}
	case "fixed_amount":
		discount = promo.DiscountValue
		if discount > subtotal {
			discount = subtotal
		}
	case "free_delivery":
		discount = deliveryFee
	}

	return discount
}

func (s *Service) toProto(promo *repository.PromoCode) *promov1.PromoCode {
	p := &promov1.PromoCode{
		Id:             promo.ID,
		Code:           promo.Code,
		DiscountType:   promo.DiscountType,
		DiscountValue:  promo.DiscountValue,
		MaxUsesPerUser: int32(promo.MaxUsesPerUser),
		FirstOrderOnly: promo.FirstOrderOnly,
		IsActive:       promo.IsActive,
		CurrentUses:    int32(promo.CurrentUses),
		RestaurantIds:  promo.RestaurantIDs,
		StartsAt:       timestamppb.New(promo.StartsAt),
		CreatedAt:      timestamppb.New(promo.CreatedAt),
		UpdatedAt:      timestamppb.New(promo.UpdatedAt),
		IsPrivate:      promo.IsPrivate,
		RequiresClaim:  promo.RequiresClaim,
		AssignedCount:  int32(promo.AssignedCount),
		ClaimedCount:   int32(promo.ClaimedCount),
	}

	if promo.MinOrderAmount != nil {
		p.MinOrderAmount = *promo.MinOrderAmount
	}
	if promo.MaxDiscountAmount != nil {
		p.MaxDiscountAmount = *promo.MaxDiscountAmount
	}
	if promo.MaxTotalUses != nil {
		p.MaxTotalUses = int32(*promo.MaxTotalUses)
	}
	if promo.ExpiresAt != nil {
		p.ExpiresAt = timestamppb.New(*promo.ExpiresAt)
	}
	if promo.Description != nil {
		p.Description = *promo.Description
	}

	return p
}

func (s *Service) userPromoToProto(upc *repository.UserPromoCode, promo *repository.PromoCode) *promov1.UserPromoCode {
	if upc == nil {
		return nil
	}

	p := &promov1.UserPromoCode{
		Id:          upc.ID,
		PromoCodeId: upc.PromoCodeID,
		UserId:      upc.UserID,
		UserEmail:   upc.UserEmail,
		Status:      upc.Status,
		AssignedAt:  timestamppb.New(upc.AssignedAt),
		CreatedAt:   timestamppb.New(upc.CreatedAt),
	}

	if upc.UserName != nil {
		p.UserName = *upc.UserName
	}
	if upc.ClaimedAt != nil {
		p.ClaimedAt = timestamppb.New(*upc.ClaimedAt)
	}
	if upc.UsedAt != nil {
		p.UsedAt = timestamppb.New(*upc.UsedAt)
	}
	if upc.UsedOrderID != nil {
		p.UsedOrderId = *upc.UsedOrderID
	}
	if upc.RevokedAt != nil {
		p.RevokedAt = timestamppb.New(*upc.RevokedAt)
	}
	if upc.RevokedReason != nil {
		p.RevokedReason = *upc.RevokedReason
	}
	if upc.ExpiresAt != nil {
		p.ExpiresAt = timestamppb.New(*upc.ExpiresAt)
	}
	if upc.Notes != nil {
		p.Notes = *upc.Notes
	}

	if promo != nil {
		p.Promo = s.toProto(promo)
	} else if upc.Promo != nil {
		p.Promo = s.toProto(upc.Promo)
	}

	return p
}

func (s *Service) requireAdmin(ctx context.Context) error {
	role, ok := ctx.Value(auth.UserRoleKey).(string)
	if !ok || role != "admin" {
		return status.Error(codes.PermissionDenied, "admin access required")
	}
	return nil
}

func (s *Service) getUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		return "", status.Error(codes.Unauthenticated, "authentication required")
	}
	return userID, nil
}

// ValidateAndCalculateDiscount is a helper for the order service
func (s *Service) ValidateAndCalculateDiscount(ctx context.Context, code, userID, restaurantID string, subtotal, deliveryFee float64) (*repository.PromoCode, float64, error) {
	promo, err := s.promoRepo.GetByCode(ctx, code)
	if err != nil {
		return nil, 0, err
	}

	errorMsg := s.validatePromoForUser(ctx, promo, userID, restaurantID, subtotal)
	if errorMsg != "" {
		return nil, 0, errors.New(errorMsg)
	}

	discount := s.calculateDiscount(promo, subtotal, deliveryFee)
	return promo, discount, nil
}

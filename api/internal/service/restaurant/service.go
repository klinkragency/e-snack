package restaurant

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/beldys/api/internal/repository"
	"github.com/beldys/api/internal/repository/postgres"
	"github.com/beldys/api/internal/service/auth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	restaurantv1 "github.com/beldys/api/gen/restaurant/v1"
)

type Service struct {
	restaurantv1.UnimplementedRestaurantServiceServer
	restaurantRepo repository.RestaurantRepository
}

func NewService(restaurantRepo repository.RestaurantRepository) *Service {
	return &Service{restaurantRepo: restaurantRepo}
}

func (s *Service) CreateRestaurant(ctx context.Context, req *restaurantv1.CreateRestaurantRequest) (*restaurantv1.Restaurant, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Name == "" || req.Slug == "" || req.Address == "" {
		return nil, status.Error(codes.InvalidArgument, "name, slug and address are required")
	}

	exists, err := s.restaurantRepo.ExistsBySlug(ctx, req.Slug)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to check slug")
	}
	if exists {
		return nil, status.Error(codes.AlreadyExists, "slug already exists")
	}

	var openingHours json.RawMessage
	if req.OpeningHours != "" {
		openingHours = json.RawMessage(req.OpeningHours)
	}

	var lat, lng *float64
	if req.Lat != 0 {
		lat = &req.Lat
	}
	if req.Lng != 0 {
		lng = &req.Lng
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	restaurant := &repository.Restaurant{
		Name:             req.Name,
		Slug:             req.Slug,
		Description:      description,
		Address:          req.Address,
		Lat:              lat,
		Lng:              lng,
		OpeningHours:     openingHours,
		DeliveryRadiusKm: req.DeliveryRadiusKm,
	}

	if restaurant.DeliveryRadiusKm == 0 {
		restaurant.DeliveryRadiusKm = 5.0
	}

	if err := s.restaurantRepo.Create(ctx, restaurant); err != nil {
		return nil, status.Error(codes.Internal, "failed to create restaurant")
	}

	return s.toProto(restaurant), nil
}

func (s *Service) GetRestaurant(ctx context.Context, req *restaurantv1.GetRestaurantRequest) (*restaurantv1.Restaurant, error) {
	if req.Slug == "" {
		return nil, status.Error(codes.InvalidArgument, "slug is required")
	}

	restaurant, err := s.restaurantRepo.GetBySlug(ctx, req.Slug)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "restaurant not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get restaurant")
	}

	return s.toProto(restaurant), nil
}

func (s *Service) ListRestaurants(ctx context.Context, req *restaurantv1.ListRestaurantsRequest) (*restaurantv1.ListRestaurantsResponse, error) {
	page := int(req.Page)
	pageSize := int(req.PageSize)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	restaurants, total, err := s.restaurantRepo.List(ctx, req.ActiveOnly, page, pageSize)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list restaurants")
	}

	protoRestaurants := make([]*restaurantv1.Restaurant, len(restaurants))
	for i, r := range restaurants {
		protoRestaurants[i] = s.toProto(r)
	}

	return &restaurantv1.ListRestaurantsResponse{
		Restaurants: protoRestaurants,
		Total:       int32(total),
		Page:        int32(page),
		PageSize:    int32(pageSize),
	}, nil
}

func (s *Service) UpdateRestaurant(ctx context.Context, req *restaurantv1.UpdateRestaurantRequest) (*restaurantv1.Restaurant, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	restaurant, err := s.restaurantRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "restaurant not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get restaurant")
	}

	if req.Name != "" {
		restaurant.Name = req.Name
	}
	if req.Slug != "" && req.Slug != restaurant.Slug {
		exists, err := s.restaurantRepo.ExistsBySlug(ctx, req.Slug)
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to check slug")
		}
		if exists {
			return nil, status.Error(codes.AlreadyExists, "slug already exists")
		}
		restaurant.Slug = req.Slug
	}
	if req.Description != "" {
		restaurant.Description = &req.Description
	}
	if req.LogoUrl != "" {
		restaurant.LogoURL = &req.LogoUrl
	}
	if req.BannerUrl != "" {
		restaurant.BannerURL = &req.BannerUrl
	}
	if req.BannerPosition != "" {
		restaurant.BannerPosition = &req.BannerPosition
	}
	if req.Address != "" {
		restaurant.Address = req.Address
	}
	if req.Lat != 0 {
		restaurant.Lat = &req.Lat
	}
	if req.Lng != 0 {
		restaurant.Lng = &req.Lng
	}
	if req.OpeningHours != "" {
		restaurant.OpeningHours = json.RawMessage(req.OpeningHours)
	}
	if req.DeliveryRadiusKm != 0 {
		restaurant.DeliveryRadiusKm = req.DeliveryRadiusKm
	}
	restaurant.IsActive = req.IsActive
	restaurant.PickupEnabled = req.PickupEnabled
	if req.DeliveryFee >= 0 {
		restaurant.DeliveryFee = req.DeliveryFee
	}
	if req.DeliveryTimeMin > 0 {
		restaurant.DeliveryTimeMin = int(req.DeliveryTimeMin)
	}
	if req.DeliveryTimeMax > 0 {
		restaurant.DeliveryTimeMax = int(req.DeliveryTimeMax)
	}
	if req.FreeDeliveryThreshold >= 0 {
		restaurant.FreeDeliveryThreshold = req.FreeDeliveryThreshold
	}
	if req.NotificationSoundUrl != "" {
		restaurant.NotificationSoundURL = &req.NotificationSoundUrl
	}

	if err := s.restaurantRepo.Update(ctx, restaurant); err != nil {
		return nil, status.Error(codes.Internal, "failed to update restaurant")
	}

	return s.toProto(restaurant), nil
}

func (s *Service) DeleteRestaurant(ctx context.Context, req *restaurantv1.DeleteRestaurantRequest) (*restaurantv1.DeleteRestaurantResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	if err := s.restaurantRepo.Delete(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "restaurant not found")
		}
		if isFKViolation(err) {
			return nil, status.Error(codes.FailedPrecondition, "Impossible de supprimer : ce restaurant est lié à des commandes existantes. Rendez-le inactif à la place.")
		}
		return nil, status.Error(codes.Internal, "failed to delete restaurant")
	}
	return &restaurantv1.DeleteRestaurantResponse{Success: true}, nil
}

// isFKViolation returns true when a Postgres error is a foreign key constraint
// violation (code 23503). Kept as defense in depth for delete flows that were
// just relaxed to ON DELETE SET NULL.
func isFKViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "23503") || strings.Contains(msg, "foreign key")
}

func (s *Service) ReorderRestaurants(ctx context.Context, req *restaurantv1.ReorderRestaurantsRequest) (*restaurantv1.ReorderRestaurantsResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	if len(req.Ids) == 0 {
		return nil, status.Error(codes.InvalidArgument, "ids is required")
	}
	if err := s.restaurantRepo.Reorder(ctx, req.Ids); err != nil {
		return nil, status.Error(codes.Internal, "failed to reorder restaurants")
	}
	return &restaurantv1.ReorderRestaurantsResponse{Success: true}, nil
}

func (s *Service) UpdateCustomization(ctx context.Context, req *restaurantv1.UpdateCustomizationRequest) (*restaurantv1.Customization, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.RestaurantId == "" {
		return nil, status.Error(codes.InvalidArgument, "restaurant_id is required")
	}

	_, err := s.restaurantRepo.GetByID(ctx, req.RestaurantId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "restaurant not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get restaurant")
	}

	customization := &repository.Customization{
		RestaurantID:   req.RestaurantId,
		PrimaryColor:   req.PrimaryColor,
		SecondaryColor: req.SecondaryColor,
		Font:           req.Font,
		Theme:          req.Theme,
	}

	if customization.PrimaryColor == "" {
		customization.PrimaryColor = "#FF6B00"
	}
	if customization.SecondaryColor == "" {
		customization.SecondaryColor = "#FFFFFF"
	}
	if customization.Font == "" {
		customization.Font = "Inter"
	}
	if customization.Theme == "" {
		customization.Theme = "light"
	}

	if err := s.restaurantRepo.UpsertCustomization(ctx, customization); err != nil {
		return nil, status.Error(codes.Internal, "failed to update customization")
	}

	return &restaurantv1.Customization{
		Id:             customization.ID,
		RestaurantId:   customization.RestaurantID,
		PrimaryColor:   customization.PrimaryColor,
		SecondaryColor: customization.SecondaryColor,
		Font:           customization.Font,
		Theme:          customization.Theme,
	}, nil
}

func (s *Service) requireAdmin(ctx context.Context) error {
	role, ok := ctx.Value(auth.UserRoleKey).(string)
	if !ok || role != "admin" {
		return status.Error(codes.PermissionDenied, "admin access required")
	}
	return nil
}

func (s *Service) toProto(r *repository.Restaurant) *restaurantv1.Restaurant {
	proto := &restaurantv1.Restaurant{
		Id:                    r.ID,
		Name:                  r.Name,
		Slug:                  r.Slug,
		Address:               r.Address,
		DeliveryRadiusKm:      r.DeliveryRadiusKm,
		DeliveryFee:           r.DeliveryFee,
		DeliveryTimeMin:       int32(r.DeliveryTimeMin),
		DeliveryTimeMax:       int32(r.DeliveryTimeMax),
		FreeDeliveryThreshold: r.FreeDeliveryThreshold,
		IsActive:              r.IsActive,
		PickupEnabled:         r.PickupEnabled,
		CreatedAt:             timestamppb.New(r.CreatedAt),
		UpdatedAt:             timestamppb.New(r.UpdatedAt),
	}

	if r.Description != nil {
		proto.Description = *r.Description
	}
	if r.LogoURL != nil {
		proto.LogoUrl = *r.LogoURL
	}
	if r.BannerURL != nil {
		proto.BannerUrl = *r.BannerURL
	}
	if r.BannerPosition != nil {
		proto.BannerPosition = *r.BannerPosition
	}
	if r.Lat != nil {
		proto.Lat = *r.Lat
	}
	if r.Lng != nil {
		proto.Lng = *r.Lng
	}
	if r.OpeningHours != nil {
		proto.OpeningHours = string(r.OpeningHours)
	}

	if r.Customization != nil {
		proto.Customization = &restaurantv1.Customization{
			Id:             r.Customization.ID,
			RestaurantId:   r.Customization.RestaurantID,
			PrimaryColor:   r.Customization.PrimaryColor,
			SecondaryColor: r.Customization.SecondaryColor,
			Font:           r.Customization.Font,
			Theme:          r.Customization.Theme,
		}
	}

	if r.NotificationSoundURL != nil {
		proto.NotificationSoundUrl = *r.NotificationSoundURL
	}

	return proto
}

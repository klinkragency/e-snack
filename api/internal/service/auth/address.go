package auth

import (
	"context"

	"github.com/klinkragency/e-snack/internal/repository"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	authv1 "github.com/klinkragency/e-snack/gen/auth/v1"
)

func (s *Service) ListDeliveryAddresses(ctx context.Context, req *authv1.ListDeliveryAddressesRequest) (*authv1.ListDeliveryAddressesResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	addresses, err := s.addressRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list addresses")
	}

	var protoAddresses []*authv1.DeliveryAddress
	for _, a := range addresses {
		protoAddresses = append(protoAddresses, addressToProto(a))
	}

	return &authv1.ListDeliveryAddressesResponse{Addresses: protoAddresses}, nil
}

func (s *Service) CreateDeliveryAddress(ctx context.Context, req *authv1.CreateDeliveryAddressRequest) (*authv1.DeliveryAddress, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if req.Label == "" || req.Address == "" {
		return nil, status.Error(codes.InvalidArgument, "label and address are required")
	}

	addr := &repository.DeliveryAddress{
		UserID:    userID,
		Label:     req.Label,
		Address:   req.Address,
		IsDefault: req.IsDefault,
	}
	if req.Lat != 0 {
		lat := req.Lat
		addr.Lat = &lat
	}
	if req.Lng != 0 {
		lng := req.Lng
		addr.Lng = &lng
	}

	if req.IsDefault {
		// Unset other defaults by setting this as default after creation
		if err := s.addressRepo.Create(ctx, addr); err != nil {
			return nil, status.Error(codes.Internal, "failed to create address")
		}
		if err := s.addressRepo.SetDefault(ctx, addr.ID, userID); err != nil {
			return nil, status.Error(codes.Internal, "failed to set default")
		}
		addr.IsDefault = true
	} else {
		if err := s.addressRepo.Create(ctx, addr); err != nil {
			return nil, status.Error(codes.Internal, "failed to create address")
		}
	}

	return addressToProto(addr), nil
}

func (s *Service) UpdateDeliveryAddress(ctx context.Context, req *authv1.UpdateDeliveryAddressRequest) (*authv1.DeliveryAddress, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "address id is required")
	}

	addr := &repository.DeliveryAddress{
		ID:      req.Id,
		UserID:  userID,
		Label:   req.Label,
		Address: req.Address,
	}
	if req.Lat != 0 {
		lat := req.Lat
		addr.Lat = &lat
	}
	if req.Lng != 0 {
		lng := req.Lng
		addr.Lng = &lng
	}

	if err := s.addressRepo.Update(ctx, addr); err != nil {
		return nil, status.Error(codes.Internal, "failed to update address")
	}

	updated, err := s.addressRepo.GetByID(ctx, req.Id, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get address")
	}

	return addressToProto(updated), nil
}

func (s *Service) DeleteDeliveryAddress(ctx context.Context, req *authv1.DeleteDeliveryAddressRequest) (*authv1.DeleteDeliveryAddressResponse, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if err := s.addressRepo.Delete(ctx, req.Id, userID); err != nil {
		return nil, status.Error(codes.Internal, "failed to delete address")
	}

	return &authv1.DeleteDeliveryAddressResponse{Success: true}, nil
}

func (s *Service) SetDefaultAddress(ctx context.Context, req *authv1.SetDefaultAddressRequest) (*authv1.DeliveryAddress, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "unauthorized")
	}

	if err := s.addressRepo.SetDefault(ctx, req.Id, userID); err != nil {
		return nil, status.Error(codes.Internal, "failed to set default address")
	}

	addr, err := s.addressRepo.GetByID(ctx, req.Id, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get address")
	}

	return addressToProto(addr), nil
}

func addressToProto(a *repository.DeliveryAddress) *authv1.DeliveryAddress {
	proto := &authv1.DeliveryAddress{
		Id:        a.ID,
		UserId:    a.UserID,
		Label:     a.Label,
		Address:   a.Address,
		IsDefault: a.IsDefault,
		CreatedAt: timestamppb.New(a.CreatedAt),
		UpdatedAt: timestamppb.New(a.UpdatedAt),
	}
	if a.Lat != nil {
		proto.Lat = *a.Lat
	}
	if a.Lng != nil {
		proto.Lng = *a.Lng
	}
	return proto
}

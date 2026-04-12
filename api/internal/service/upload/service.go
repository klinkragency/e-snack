package upload

import (
	"context"
	"log"

	"github.com/beldys/api/internal/service/auth"
	"github.com/beldys/api/internal/storage"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	uploadv1 "github.com/beldys/api/gen/upload/v1"
)

var allowedContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

var allowedCategories = map[string]bool{
	"restaurant_logo":   true,
	"restaurant_banner": true,
	"product":           true,
}

type Service struct {
	uploadv1.UnimplementedUploadServiceServer
	uploadClient storage.StorageClient
}

func NewService(uploadClient storage.StorageClient) *Service {
	return &Service{uploadClient: uploadClient}
}

func (s *Service) GetPresignedUploadURL(ctx context.Context, req *uploadv1.UploadURLRequest) (*uploadv1.UploadURLResponse, error) {
	if err := s.requireAuth(ctx); err != nil {
		return nil, err
	}

	if s.uploadClient == nil {
		return nil, status.Error(codes.Unavailable, "upload service not configured")
	}

	if !allowedContentTypes[req.ContentType] {
		return nil, status.Error(codes.InvalidArgument, "invalid content type, allowed: image/jpeg, image/png, image/webp")
	}

	if !allowedCategories[req.Category] {
		return nil, status.Error(codes.InvalidArgument, "invalid category, allowed: restaurant_logo, restaurant_banner, product")
	}

	fileSize := req.FileSize
	if fileSize <= 0 {
		fileSize = 10 * 1024 * 1024 // Default 10MB if not provided
	}

	uploadURL, fileKey, publicURL, expiresIn, err := s.uploadClient.GeneratePresignedUploadURL(
		ctx, req.Category, req.ContentType, req.Filename, fileSize,
	)
	if err != nil {
		log.Printf("Storage error: %v", err)
		return nil, status.Error(codes.Internal, "failed to generate upload URL")
	}

	return &uploadv1.UploadURLResponse{
		UploadUrl: uploadURL,
		FileKey:   fileKey,
		PublicUrl: publicURL,
		ExpiresIn: expiresIn,
	}, nil
}

func (s *Service) ConfirmUpload(ctx context.Context, req *uploadv1.ConfirmUploadRequest) (*uploadv1.ConfirmUploadResponse, error) {
	if err := s.requireAuth(ctx); err != nil {
		return nil, err
	}

	if s.uploadClient == nil {
		return nil, status.Error(codes.Unavailable, "upload service not configured")
	}

	if req.FileKey == "" {
		return nil, status.Error(codes.InvalidArgument, "file_key is required")
	}

	exists, size, err := s.uploadClient.CheckFileExists(ctx, req.FileKey)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to check file")
	}

	return &uploadv1.ConfirmUploadResponse{
		Exists:    exists,
		PublicUrl: s.uploadClient.GetPublicURL(req.FileKey),
		Size:      size,
	}, nil
}

func (s *Service) requireAuth(ctx context.Context) error {
	userID, ok := ctx.Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		return status.Error(codes.Unauthenticated, "authentication required")
	}
	return nil
}

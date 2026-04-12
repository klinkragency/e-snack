package storage

import (
	"context"
	"io"
)

// StorageClient is the interface for file storage backends.
type StorageClient interface {
	GeneratePresignedUploadURL(ctx context.Context, category, contentType, filename string, fileSize int64) (uploadURL, fileKey, publicURL string, expiresIn int64, err error)
	PutObject(ctx context.Context, category, contentType, filename string, data io.Reader, size int64) (fileKey, publicURL string, err error)
	CheckFileExists(ctx context.Context, fileKey string) (bool, int64, error)
	GetPublicURL(fileKey string) string
	DeleteFile(ctx context.Context, fileKey string) error
}

func getExtension(contentType string) string {
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	default:
		return ".bin"
	}
}

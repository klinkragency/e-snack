package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const presignExpiry = 15 * time.Minute

type MinIOClient struct {
	client    *minio.Client
	bucket    string
	publicURL string // e.g. http://51.255.203.25/uploads
}

type MinIOConfig struct {
	Endpoint  string // minio:9000 (internal) or public URL
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	PublicURL string // External URL where files are served
}

func NewMinIOClient(cfg MinIOConfig) (*MinIOClient, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	ctx := context.Background()
	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
		// Set bucket policy to allow public read
		policy := fmt.Sprintf(`{
			"Version": "2012-10-17",
			"Statement": [{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetObject"],
				"Resource": ["arn:aws:s3:::%s/*"]
			}]
		}`, cfg.Bucket)
		if err := client.SetBucketPolicy(ctx, cfg.Bucket, policy); err != nil {
			return nil, fmt.Errorf("failed to set bucket policy: %w", err)
		}
	}

	return &MinIOClient{
		client:    client,
		bucket:    cfg.Bucket,
		publicURL: cfg.PublicURL,
	}, nil
}

func (c *MinIOClient) GeneratePresignedUploadURL(ctx context.Context, category, contentType, filename string, fileSize int64) (uploadURL, fileKey, publicURL string, expiresIn int64, err error) {
	ext := getExtension(contentType)
	fileKey = fmt.Sprintf("%s-%s%s", category, uuid.New().String(), ext)

	reqParams := make(url.Values)
	reqParams.Set("Content-Type", contentType)

	presigned, err := c.client.PresignedPutObject(ctx, c.bucket, fileKey, presignExpiry)
	if err != nil {
		return "", "", "", 0, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	publicURL = fmt.Sprintf("%s/%s", c.publicURL, fileKey)
	return presigned.String(), fileKey, publicURL, int64(presignExpiry.Seconds()), nil
}

func (c *MinIOClient) CheckFileExists(ctx context.Context, fileKey string) (bool, int64, error) {
	info, err := c.client.StatObject(ctx, c.bucket, fileKey, minio.StatObjectOptions{})
	if err != nil {
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return false, 0, nil
		}
		return false, 0, nil
	}
	return true, info.Size, nil
}

func (c *MinIOClient) GetPublicURL(fileKey string) string {
	return fmt.Sprintf("%s/%s", c.publicURL, fileKey)
}

func (c *MinIOClient) DeleteFile(ctx context.Context, fileKey string) error {
	return c.client.RemoveObject(ctx, c.bucket, fileKey, minio.RemoveObjectOptions{})
}

func (c *MinIOClient) PutObject(ctx context.Context, category, contentType, filename string, data io.Reader, size int64) (fileKey, publicURL string, err error) {
	ext := getExtension(contentType)
	fileKey = fmt.Sprintf("%s-%s%s", category, uuid.New().String(), ext)

	_, err = c.client.PutObject(ctx, c.bucket, fileKey, data, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to upload file: %w", err)
	}

	return fileKey, fmt.Sprintf("%s/%s", c.publicURL, fileKey), nil
}

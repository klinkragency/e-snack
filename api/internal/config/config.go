package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Env           string
	GRPCPort      string
	HTTPPort      string
	AllowedOrigin string

	DatabaseURL string
	RedisURL    string

	JWT    JWTConfig
	Admin  AdminConfig
	MinIO  MinIOConfig
	Mollie MollieConfig
	OAuth  OAuthConfig
	Email  EmailConfig
	OpenAI OpenAIConfig
}

type OpenAIConfig struct {
	APIKey string
}

type OAuthConfig struct {
	GoogleClientID string
}

type EmailConfig struct {
	Provider  string // resend, smtp
	APIKey    string // Resend API key (re_...)
	FromEmail string
	FromName  string
	SMTPHost  string
	SMTPPort  string
}

type MollieConfig struct {
	APIKey    string
	PublicURL string
}

type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	PublicURL string
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type AdminConfig struct {
	Email    string
	Password string
}

const defaultJWTSecret = "change-this-to-a-secure-secret-in-production"

func Load() (*Config, error) {
	_ = godotenv.Load()

	env := getEnv("ENV", "development")

	accessExpiry, err := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	if err != nil {
		accessExpiry = 15 * time.Minute
	}

	refreshExpiry, err := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))
	if err != nil {
		refreshExpiry = 168 * time.Hour
	}

	jwtSecret := getEnv("JWT_SECRET", defaultJWTSecret)
	if env == "production" && jwtSecret == defaultJWTSecret {
		return nil, fmt.Errorf("CRITICAL: JWT_SECRET must be set in production (do not use default)")
	}

	adminPassword := getEnv("ADMIN_PASSWORD", "admin123")
	if env == "production" && len(adminPassword) < 12 {
		return nil, fmt.Errorf("CRITICAL: ADMIN_PASSWORD must be at least 12 characters in production")
	}

	return &Config{
		Env:           env,
		GRPCPort:      getEnv("GRPC_PORT", "50051"),
		HTTPPort:      getEnv("HTTP_PORT", "8080"),
		AllowedOrigin: getEnv("ALLOWED_ORIGIN", ""),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://beldys:beldys_secret@localhost:5432/beldys_db?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		JWT: JWTConfig{
			Secret:        jwtSecret,
			AccessExpiry:  accessExpiry,
			RefreshExpiry: refreshExpiry,
		},
		Admin: AdminConfig{
			Email:    getEnv("ADMIN_EMAIL", "admin@beldys.club"),
			Password: adminPassword,
		},
		MinIO: MinIOConfig{
			Endpoint:  getEnv("MINIO_ENDPOINT", "minio:9000"),
			AccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin"),
			Bucket:    getEnv("MINIO_BUCKET", "beldys"),
			UseSSL:    getEnv("MINIO_USE_SSL", "false") == "true",
			PublicURL: getEnv("MINIO_PUBLIC_URL", "http://localhost:9000/beldys"),
		},
		Mollie: MollieConfig{
			APIKey:    getEnv("MOLLIE_API_KEY", ""),
			PublicURL: getEnv("PUBLIC_URL", "http://localhost:3000"),
		},
		OAuth: OAuthConfig{
			GoogleClientID: getEnv("GOOGLE_CLIENT_ID", ""),
		},
		OpenAI: OpenAIConfig{
			APIKey: getEnv("OPENAI_API_KEY", ""),
		},
		Email: EmailConfig{
			Provider:  getEnv("EMAIL_PROVIDER", "smtp"),
			APIKey:    getEnv("EMAIL_API_KEY", ""),
			FromEmail: getEnv("EMAIL_FROM", "noreply@beldys.club"),
			FromName:  getEnv("EMAIL_FROM_NAME", "Beldys Club"),
			SMTPHost:  getEnv("SMTP_HOST", "localhost"),
			SMTPPort:  getEnv("SMTP_PORT", "1025"),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}


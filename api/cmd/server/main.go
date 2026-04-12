package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/klinkragency/e-snack/internal/config"
	"github.com/klinkragency/e-snack/internal/mollie"
	"github.com/klinkragency/e-snack/internal/repository"
	"github.com/klinkragency/e-snack/internal/repository/postgres"
	"github.com/klinkragency/e-snack/internal/server"
	"github.com/klinkragency/e-snack/internal/service/auth"
	"github.com/klinkragency/e-snack/internal/service/delivery"
	"github.com/klinkragency/e-snack/internal/service/email"
	"github.com/klinkragency/e-snack/internal/service/menu"
	"github.com/klinkragency/e-snack/internal/service/order"
	"github.com/klinkragency/e-snack/internal/service/payment"
	"github.com/klinkragency/e-snack/internal/service/promo"
	"github.com/klinkragency/e-snack/internal/service/restaurant"
	"github.com/klinkragency/e-snack/internal/service/upload"
	"github.com/klinkragency/e-snack/internal/storage"
	"github.com/klinkragency/e-snack/internal/websocket"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx := context.Background()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to PostgreSQL")

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	redisClient := redis.NewClient(opt)
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis")

	var uploadClient storage.StorageClient
	uploadClient, err = storage.NewMinIOClient(storage.MinIOConfig{
		Endpoint:  cfg.MinIO.Endpoint,
		AccessKey: cfg.MinIO.AccessKey,
		SecretKey: cfg.MinIO.SecretKey,
		Bucket:    cfg.MinIO.Bucket,
		UseSSL:    cfg.MinIO.UseSSL,
		PublicURL: cfg.MinIO.PublicURL,
	})
	if err != nil {
		log.Printf("Warning: Failed to initialize MinIO client: %v", err)
		uploadClient = nil
	} else {
		log.Println("MinIO storage client initialized")
	}

	var mollieClient *mollie.Client
	if cfg.Mollie.APIKey != "" {
		mollieClient = mollie.NewClient(cfg.Mollie.APIKey)
		log.Println("Mollie client initialized")
	} else {
		log.Println("Mollie API key not configured, payments disabled")
	}

	userRepo := postgres.NewUserRepository(db)
	oauthRepo := postgres.NewOAuthAccountRepository(db)
	otpRepo := postgres.NewOTPRepository(db)
	restaurantRepo := postgres.NewRestaurantRepository(db)
	categoryRepo := postgres.NewCategoryRepository(db)
	productRepo := postgres.NewProductRepository(db)
	optionRepo := postgres.NewProductOptionRepository(db)
	orderRepo := postgres.NewOrderRepository(db)
	addressRepo := postgres.NewDeliveryAddressRepository(db)
	promoRepo := postgres.NewPromoRepository(db)
	userPromoRepo := postgres.NewUserPromoRepository(db)
	driverRepo := postgres.NewDriverRepository(db)
	formulaRepo := postgres.NewFormulaRepository(db, optionRepo)

	// Initialize WebSocket hub
	wsHub := websocket.NewHub(redisClient)
	go wsHub.Run()

	jwtManager := auth.NewJWTManager(
		cfg.JWT.Secret,
		cfg.JWT.AccessExpiry,
		cfg.JWT.RefreshExpiry,
	)

	var emailService email.EmailService
	switch cfg.Email.Provider {
	case "resend":
		from := fmt.Sprintf("%s <%s>", cfg.Email.FromName, cfg.Email.FromEmail)
		emailService = email.NewResendService(cfg.Email.APIKey, from)
	default:
		emailService = email.NewSMTPService(cfg.Email.SMTPHost, cfg.Email.SMTPPort, cfg.Email.FromEmail, cfg.Email.FromName)
	}
	otpService := auth.NewOTPService(otpRepo, userRepo, redisClient, emailService)

	authService := auth.NewService(userRepo, oauthRepo, addressRepo, otpService, jwtManager, redisClient, cfg.OAuth.GoogleClientID)
	restaurantService := restaurant.NewService(restaurantRepo)
	menuService := menu.NewService(restaurantRepo, categoryRepo, productRepo, optionRepo, formulaRepo, cfg.OpenAI.APIKey)
	uploadService := upload.NewService(uploadClient)
	promoService := promo.NewService(promoRepo, userPromoRepo, orderRepo)
	orderService := order.NewService(orderRepo, restaurantRepo, productRepo, optionRepo, formulaRepo, promoService, redisClient, wsHub)
	webhookRepo := postgres.NewPaymentWebhookRepository(db)
	paymentService := payment.NewService(mollieClient, orderRepo, webhookRepo, cfg.Mollie.PublicURL)
	deliveryService := delivery.NewService(driverRepo, orderRepo, restaurantRepo, userRepo, wsHub)

	if err := seedAdmin(ctx, userRepo, cfg.Admin); err != nil {
		log.Printf("Warning: Failed to seed admin: %v", err)
	}

	grpcServer := server.NewGRPCServer(
		cfg.GRPCPort,
		authService,
		restaurantService,
		menuService,
		uploadService,
		orderService,
		paymentService,
		promoService,
		deliveryService,
		jwtManager,
		cfg.Env,
	)
	gatewayServer := server.NewGatewayServer(cfg.HTTPPort, cfg.GRPCPort, cfg.AllowedOrigin, wsHub, jwtManager, paymentService, redisClient, uploadClient, orderRepo)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := grpcServer.Start(); err != nil {
			log.Fatalf("Failed to start gRPC server: %v", err)
		}
	}()

	go func() {
		if err := gatewayServer.Start(ctx); err != nil {
			log.Fatalf("Failed to start HTTP gateway: %v", err)
		}
	}()

	// Worker de traitement des webhooks Mollie (outbox pattern)
	go paymentService.StartWorker(ctx)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down servers...")
	grpcServer.Stop()
	gatewayServer.Stop(ctx)
	log.Println("Servers stopped")
}

func seedAdmin(ctx context.Context, userRepo repository.UserRepository, adminCfg config.AdminConfig) error {
	exists, err := userRepo.ExistsByEmail(ctx, adminCfg.Email)
	if err != nil {
		return err
	}
	if exists {
		log.Printf("Admin user %s already exists", adminCfg.Email)
		return nil
	}

	passwordHash, err := auth.HashPassword(adminCfg.Password)
	if err != nil {
		return err
	}

	user := &repository.User{
		Email:        adminCfg.Email,
		PasswordHash: &passwordHash,
		Role:         "admin",
	}

	if err := userRepo.Create(ctx, user); err != nil {
		return err
	}

	log.Printf("Admin user %s created successfully", adminCfg.Email)
	return nil
}

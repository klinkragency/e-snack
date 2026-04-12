package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/beldys/api/internal/repository"
	"github.com/beldys/api/internal/service/auth"
	"github.com/beldys/api/internal/storage"
	"github.com/beldys/api/internal/websocket"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "github.com/beldys/api/gen/auth/v1"
	deliveryv1 "github.com/beldys/api/gen/delivery/v1"
	menuv1 "github.com/beldys/api/gen/menu/v1"
	orderv1 "github.com/beldys/api/gen/order/v1"
	paymentv1 "github.com/beldys/api/gen/payment/v1"
	promov1 "github.com/beldys/api/gen/promo/v1"
	restaurantv1 "github.com/beldys/api/gen/restaurant/v1"
	uploadv1 "github.com/beldys/api/gen/upload/v1"
)

const maintenanceRedisKey = "beldys:maintenance"

type MaintenanceStatus struct {
	Enabled   bool   `json:"enabled"`
	Message   string `json:"message,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type GatewayServer struct {
	httpServer     *http.Server
	port           string
	grpcPort       string
	allowedOrigin  string
	wsHub          *websocket.Hub
	jwtManager     *auth.JWTManager
	paymentWebhook http.Handler
	redis          *redis.Client
	storageClient  storage.StorageClient
	orderRepo      repository.OrderRepository
}

// PaymentWebhookHandler interface for handling payment webhooks
type PaymentWebhookHandler interface {
	HandleWebhook(w http.ResponseWriter, r *http.Request)
}

func NewGatewayServer(port, grpcPort, allowedOrigin string, wsHub *websocket.Hub, jwtManager *auth.JWTManager, paymentWebhook PaymentWebhookHandler, redisClient *redis.Client, storageClient storage.StorageClient, orderRepo repository.OrderRepository) *GatewayServer {
	var webhookHandler http.Handler
	if paymentWebhook != nil {
		webhookHandler = http.HandlerFunc(paymentWebhook.HandleWebhook)
	}
	return &GatewayServer{
		port:           port,
		grpcPort:       grpcPort,
		allowedOrigin:  allowedOrigin,
		wsHub:          wsHub,
		jwtManager:     jwtManager,
		paymentWebhook: webhookHandler,
		redis:          redisClient,
		storageClient:  storageClient,
		orderRepo:      orderRepo,
	}
}

func (s *GatewayServer) Start(ctx context.Context) error {
	mux := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(customHeaderMatcher),
	)

	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	grpcEndpoint := fmt.Sprintf("localhost:%s", s.grpcPort)

	if err := authv1.RegisterAuthServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register auth service handler: %w", err)
	}

	if err := restaurantv1.RegisterRestaurantServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register restaurant service handler: %w", err)
	}

	if err := menuv1.RegisterMenuServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register menu service handler: %w", err)
	}

	if err := uploadv1.RegisterUploadServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register upload service handler: %w", err)
	}

	if err := orderv1.RegisterOrderServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register order service handler: %w", err)
	}

	if err := paymentv1.RegisterPaymentServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register payment service handler: %w", err)
	}

	if err := promov1.RegisterPromoServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register promo service handler: %w", err)
	}

	if err := deliveryv1.RegisterDeliveryServiceHandlerFromEndpoint(ctx, mux, grpcEndpoint, opts); err != nil {
		return fmt.Errorf("failed to register delivery service handler: %w", err)
	}

	// Create main handler with WebSocket routes
	mainHandler := http.NewServeMux()

	// WebSocket route for order tracking (client side)
	// GET /ws/tracking/{orderID}
	mainHandler.HandleFunc("/ws/tracking/", s.handleOrderTrackingWS)

	// WebSocket route for drivers
	// GET /ws/driver
	mainHandler.HandleFunc("/ws/driver", s.handleDriverWS)

	// Mollie payment webhook
	// POST /api/v1/webhook/mollie
	if s.paymentWebhook != nil {
		mainHandler.Handle("/api/v1/webhook/mollie", s.paymentWebhook)
		log.Println("Mollie webhook enabled at /api/v1/webhook/mollie")
	}

	// Health check for Docker/load balancer
	mainHandler.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Maintenance mode endpoints
	mainHandler.HandleFunc("/api/v1/maintenance", s.handleMaintenance)

	// Direct multipart file upload (bypasses MinIO presigned URLs)
	mainHandler.HandleFunc("/api/v1/upload/file", s.handleUploadFile)

	// Admin: mark C&C on-site order as paid — PATCH /api/v1/admin/mark-paid/{id}
	mainHandler.HandleFunc("/api/v1/admin/mark-paid/", s.handleMarkPaid)

	// All other routes go to gRPC gateway
	mainHandler.Handle("/", mux)

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%s", s.port),
		Handler: corsMiddleware(mainHandler, s.allowedOrigin),
	}

	log.Printf("HTTP gateway listening on :%s", s.port)
	return s.httpServer.ListenAndServe()
}

func (s *GatewayServer) Stop(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func customHeaderMatcher(key string) (string, bool) {
	switch key {
	case "Authorization", "Content-Type":
		return key, true
	default:
		return runtime.DefaultHeaderMatcher(key)
	}
}

func corsMiddleware(handler http.Handler, allowedOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := allowedOrigin
		if origin == "" {
			origin = "http://localhost:3000"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Authorization")
		if origin != "*" {
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		handler.ServeHTTP(w, r)
	})
}

// handleOrderTrackingWS handles WebSocket connections for order tracking
// GET /ws/tracking/{orderID}
func (s *GatewayServer) handleOrderTrackingWS(w http.ResponseWriter, r *http.Request) {
	if s.wsHub == nil {
		http.Error(w, "WebSocket not available", http.StatusServiceUnavailable)
		return
	}

	// Extract order ID from path
	path := strings.TrimPrefix(r.URL.Path, "/ws/tracking/")
	orderID := strings.TrimSuffix(path, "/")
	if orderID == "" {
		http.Error(w, "order ID required", http.StatusBadRequest)
		return
	}

	// Authenticate user from token (query param or header)
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("Authorization")
		token = strings.TrimPrefix(token, "Bearer ")
	}

	var userID string
	if token != "" && s.jwtManager != nil {
		claims, err := s.jwtManager.ValidateToken(token)
		if err == nil {
			userID = claims.UserID
		}
	}

	// Fetch current order status to send on connect
	var initialStatus string
	if s.orderRepo != nil {
		if order, err := s.orderRepo.GetByID(r.Context(), orderID); err == nil {
			initialStatus = string(order.Status)
		}
	}

	websocket.ServeOrderTrackingWS(s.wsHub, w, r, orderID, userID, initialStatus)
}

// handleDriverWS handles WebSocket connections for drivers
// GET /ws/driver
func (s *GatewayServer) handleDriverWS(w http.ResponseWriter, r *http.Request) {
	if s.wsHub == nil {
		http.Error(w, "WebSocket not available", http.StatusServiceUnavailable)
		return
	}

	// Authenticate driver from token
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("Authorization")
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" || s.jwtManager == nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}

	claims, err := s.jwtManager.ValidateToken(token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	if claims.Role != "livreur" {
		http.Error(w, "driver access required", http.StatusForbidden)
		return
	}

	websocket.ServeDriverWS(s.wsHub, w, r, claims.UserID, claims.UserID)
}

// handleMaintenance handles GET (public) and PUT (admin-only) for maintenance mode
func (s *GatewayServer) handleMaintenance(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getMaintenanceStatus(w, r)
	case http.MethodPut:
		s.setMaintenanceStatus(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *GatewayServer) getMaintenanceStatus(w http.ResponseWriter, _ *http.Request) {
	val, err := s.redis.Get(context.Background(), maintenanceRedisKey).Result()
	if err == redis.Nil || err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(MaintenanceStatus{Enabled: false})
		return
	}

	var status MaintenanceStatus
	if err := json.Unmarshal([]byte(val), &status); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(MaintenanceStatus{Enabled: false})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (s *GatewayServer) setMaintenanceStatus(w http.ResponseWriter, r *http.Request) {
	// Require admin JWT
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")
	if token == "" || s.jwtManager == nil {
		http.Error(w, `{"message":"Authentication required"}`, http.StatusUnauthorized)
		return
	}
	claims, err := s.jwtManager.ValidateToken(token)
	if err != nil || claims.Role != "admin" {
		http.Error(w, `{"message":"Admin access required"}`, http.StatusForbidden)
		return
	}

	var body struct {
		Enabled bool   `json:"enabled"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"message":"Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if !body.Enabled {
		// Delete the key entirely — no stale state left in Redis
		s.redis.Del(context.Background(), maintenanceRedisKey)
		log.Printf("Maintenance mode disabled by admin %s", claims.UserID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(MaintenanceStatus{Enabled: false})
		return
	}

	status := MaintenanceStatus{
		Enabled:   true,
		Message:   body.Message,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	data, _ := json.Marshal(status)
	// 24h TTL safety net — maintenance auto-expires if admin forgets
	if err := s.redis.Set(context.Background(), maintenanceRedisKey, string(data), 24*time.Hour).Err(); err != nil {
		log.Printf("Failed to set maintenance mode: %v", err)
		http.Error(w, `{"message":"Failed to update maintenance mode"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Maintenance mode enabled by admin %s (auto-expires in 24h)", claims.UserID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// handleUploadFile handles direct multipart file upload via Go API
// POST /api/v1/upload/file
// Accepts: multipart/form-data with fields: file (binary), category (string)
// Returns: {"fileKey": "...", "publicUrl": "..."}
func (s *GatewayServer) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"message":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Require authentication
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")
	if token == "" || s.jwtManager == nil {
		http.Error(w, `{"message":"Authentication required"}`, http.StatusUnauthorized)
		return
	}
	if _, err := s.jwtManager.ValidateToken(token); err != nil {
		http.Error(w, `{"message":"Invalid token"}`, http.StatusUnauthorized)
		return
	}

	if s.storageClient == nil {
		http.Error(w, `{"message":"Storage not configured"}`, http.StatusServiceUnavailable)
		return
	}

	// Limit to 10MB
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, `{"message":"File too large or invalid form"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"message":"Missing file field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	category := r.FormValue("category")
	if category == "" {
		category = "upload"
	}

	// Detect content type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Only allow images and audio
	allowedTypes := map[string]bool{
		"image/jpeg":  true,
		"image/png":   true,
		"image/webp":  true,
		"audio/mpeg":  true,
		"audio/mp3":   true,
	}
	if !allowedTypes[contentType] {
		http.Error(w, `{"message":"Only JPEG, PNG, WebP images and MP3 audio are allowed"}`, http.StatusBadRequest)
		return
	}

	// Cast to ReadSeeker to get size, then reset to start
	type readSeeker interface {
		io.Reader
		io.Seeker
	}
	var size int64 = header.Size

	fileKey, publicURL, err := s.storageClient.PutObject(r.Context(), category, contentType, header.Filename, file, size)
	if err != nil {
		log.Printf("Upload error: %v", err)
		http.Error(w, `{"message":"Failed to upload file"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"fileKey":   fileKey,
		"publicUrl": publicURL,
	})
}

// handleMarkPaid marks a C&C on-site order as paid.
// PATCH /api/v1/admin/mark-paid/{id}
func (s *GatewayServer) handleMarkPaid(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPatch {
http.Error(w, `{"message":"Method not allowed"}`, http.StatusMethodNotAllowed)
return
}

// Require admin JWT
token := r.Header.Get("Authorization")
token = strings.TrimPrefix(token, "Bearer ")
if token == "" || s.jwtManager == nil {
http.Error(w, `{"message":"Authentication required"}`, http.StatusUnauthorized)
return
}
claims, err := s.jwtManager.ValidateToken(token)
if err != nil || claims.Role != "admin" {
http.Error(w, `{"message":"Admin access required"}`, http.StatusForbidden)
return
}

// Extract order ID from path: /api/v1/admin/mark-paid/{id}
id := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/mark-paid/")
id = strings.TrimSuffix(id, "/")
if id == "" {
http.Error(w, `{"message":"Order ID required"}`, http.StatusBadRequest)
return
}

if s.orderRepo == nil {
http.Error(w, `{"message":"Service unavailable"}`, http.StatusServiceUnavailable)
return
}

// Fetch order to validate it's an on-site payment C&C order
order, err := s.orderRepo.GetByID(r.Context(), id)
if err != nil {
http.Error(w, `{"message":"Order not found"}`, http.StatusNotFound)
return
}
if order.PaymentStatus != "on_site" {
http.Error(w, `{"message":"Cette commande n'est pas en paiement sur place"}`, http.StatusBadRequest)
return
}

// Mark as paid
if err := s.orderRepo.UpdatePaymentStatus(r.Context(), id, "paid", nil); err != nil {
log.Printf("handleMarkPaid: failed to update payment status for order %s: %v", id, err)
http.Error(w, `{"message":"Failed to update payment status"}`, http.StatusInternalServerError)
return
}

w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]string{"status": "paid", "orderId": id})
}

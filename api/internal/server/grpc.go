package server

import (
	"fmt"
	"log"
	"net"

	"github.com/beldys/api/internal/middleware"
	"github.com/beldys/api/internal/service/auth"
	"github.com/beldys/api/internal/service/delivery"
	"github.com/beldys/api/internal/service/menu"
	"github.com/beldys/api/internal/service/order"
	"github.com/beldys/api/internal/service/payment"
	"github.com/beldys/api/internal/service/promo"
	"github.com/beldys/api/internal/service/restaurant"
	"github.com/beldys/api/internal/service/upload"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	authv1 "github.com/beldys/api/gen/auth/v1"
	deliveryv1 "github.com/beldys/api/gen/delivery/v1"
	menuv1 "github.com/beldys/api/gen/menu/v1"
	orderv1 "github.com/beldys/api/gen/order/v1"
	paymentv1 "github.com/beldys/api/gen/payment/v1"
	promov1 "github.com/beldys/api/gen/promo/v1"
	restaurantv1 "github.com/beldys/api/gen/restaurant/v1"
	uploadv1 "github.com/beldys/api/gen/upload/v1"
)

type GRPCServer struct {
	server            *grpc.Server
	authService       *auth.Service
	restaurantService *restaurant.Service
	menuService       *menu.Service
	uploadService     *upload.Service
	orderService      *order.Service
	paymentService    *payment.Service
	promoService      *promo.Service
	deliveryService   *delivery.Service
	port              string
}

func NewGRPCServer(
	port string,
	authService *auth.Service,
	restaurantService *restaurant.Service,
	menuService *menu.Service,
	uploadService *upload.Service,
	orderService *order.Service,
	paymentService *payment.Service,
	promoService *promo.Service,
	deliveryService *delivery.Service,
	jwtManager *auth.JWTManager,
	env string,
) *GRPCServer {
	authInterceptor := middleware.NewAuthInterceptor(jwtManager)

	server := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			middleware.LoggingUnaryInterceptor(),
			authInterceptor.Unary(),
		),
		grpc.ChainStreamInterceptor(
			middleware.LoggingStreamInterceptor(),
			authInterceptor.Stream(),
		),
	)

	authv1.RegisterAuthServiceServer(server, authService)
	restaurantv1.RegisterRestaurantServiceServer(server, restaurantService)
	menuv1.RegisterMenuServiceServer(server, menuService)
	uploadv1.RegisterUploadServiceServer(server, uploadService)
	orderv1.RegisterOrderServiceServer(server, orderService)
	paymentv1.RegisterPaymentServiceServer(server, paymentService)
	promov1.RegisterPromoServiceServer(server, promoService)
	deliveryv1.RegisterDeliveryServiceServer(server, deliveryService)
	if env != "production" {
		reflection.Register(server)
	}

	return &GRPCServer{
		server:            server,
		authService:       authService,
		restaurantService: restaurantService,
		menuService:       menuService,
		uploadService:     uploadService,
		orderService:      orderService,
		paymentService:    paymentService,
		promoService:      promoService,
		deliveryService:   deliveryService,
		port:              port,
	}
}

func (s *GRPCServer) Start() error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%s", s.port))
	if err != nil {
		return fmt.Errorf("failed to listen on port %s: %w", s.port, err)
	}

	log.Printf("gRPC server listening on :%s", s.port)
	return s.server.Serve(listener)
}

func (s *GRPCServer) Stop() {
	s.server.GracefulStop()
}

func (s *GRPCServer) Server() *grpc.Server {
	return s.server
}

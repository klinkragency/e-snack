package middleware

import (
	"context"
	"strings"

	"github.com/klinkragency/e-snack/internal/service/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var publicMethods = map[string]bool{
	// Auth - public
	"/beldys.auth.v1.AuthService/Register":          true,
	"/beldys.auth.v1.AuthService/Login":             true,
	"/beldys.auth.v1.AuthService/RefreshToken":      true,
	"/beldys.auth.v1.AuthService/OAuthLogin":        true,
	"/beldys.auth.v1.AuthService/ForgotPassword":    true,
	"/beldys.auth.v1.AuthService/VerifyResetCode":   true,
	"/beldys.auth.v1.AuthService/ResetPassword":     true,
	"/beldys.auth.v1.AuthService/Verify2FA":         true,
	// Restaurant - public read
	"/beldys.restaurant.v1.RestaurantService/GetRestaurant":   true,
	"/beldys.restaurant.v1.RestaurantService/ListRestaurants": true,
	// Menu - public read
	"/beldys.menu.v1.MenuService/GetMenu": true,
}

type AuthInterceptor struct {
	jwtManager *auth.JWTManager
}

func NewAuthInterceptor(jwtManager *auth.JWTManager) *AuthInterceptor {
	return &AuthInterceptor{jwtManager: jwtManager}
}

func (i *AuthInterceptor) Unary() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		if publicMethods[info.FullMethod] {
			return handler(ctx, req)
		}

		ctx, err := i.authorize(ctx)
		if err != nil {
			return nil, err
		}

		return handler(ctx, req)
	}
}

func (i *AuthInterceptor) Stream() grpc.StreamServerInterceptor {
	return func(
		srv interface{},
		stream grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		if publicMethods[info.FullMethod] {
			return handler(srv, stream)
		}

		ctx, err := i.authorize(stream.Context())
		if err != nil {
			return err
		}

		wrapped := &wrappedStream{
			ServerStream: stream,
			ctx:          ctx,
		}

		return handler(srv, wrapped)
	}
}

func (i *AuthInterceptor) authorize(ctx context.Context) (context.Context, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "metadata is not provided")
	}

	values := md.Get("authorization")
	if len(values) == 0 {
		return nil, status.Error(codes.Unauthenticated, "authorization token is not provided")
	}

	token := values[0]
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	claims, err := i.jwtManager.ValidateToken(token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token: "+err.Error())
	}

	ctx = context.WithValue(ctx, auth.UserIDKey, claims.UserID)
	ctx = context.WithValue(ctx, auth.UserRoleKey, claims.Role)

	return ctx, nil
}

type wrappedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *wrappedStream) Context() context.Context {
	return w.ctx
}

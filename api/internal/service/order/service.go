package order

import (
	"context"
	"encoding/json"
	"errors"
	"log"

	"github.com/klinkragency/e-snack/internal/repository"
	"github.com/klinkragency/e-snack/internal/repository/postgres"
	"github.com/klinkragency/e-snack/internal/service/auth"
	"github.com/klinkragency/e-snack/internal/service/promo"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	orderv1 "github.com/klinkragency/e-snack/gen/order/v1"
	promov1 "github.com/klinkragency/e-snack/gen/promo/v1"
)

var validOrderTypes = map[string]bool{
	"delivery": true,
	"pickup":   true,
	"dine_in":  true,
}

var validStatuses = map[string]bool{
	"pending":          true,
	"confirmed":        true,
	"preparing":        true,
	"ready":            true,
	"out_for_delivery": true,
	"delivered":        true,
	"cancelled":        true,
	"refunded":         true,
}

// validTransitions defines allowed status transitions
var validTransitions = map[string]map[string]bool{
	"pending":          {"confirmed": true, "cancelled": true},
	"confirmed":        {"preparing": true, "cancelled": true},
	"preparing":        {"ready": true, "cancelled": true},
	"ready":            {"out_for_delivery": true, "delivered": true, "cancelled": true},
	"out_for_delivery": {"delivered": true, "cancelled": true},
	"delivered":        {"refunded": true},
	"cancelled":        {},
	"refunded":         {},
}

// WebSocketHub interface for broadcasting real-time order status updates
type WebSocketHub interface {
	BroadcastOrderStatus(orderID, status string)
}

type Service struct {
	orderv1.UnimplementedOrderServiceServer
	orderRepo      repository.OrderRepository
	restaurantRepo repository.RestaurantRepository
	productRepo    repository.ProductRepository
	optionRepo     repository.ProductOptionRepository
	formulaRepo    repository.FormulaRepository
	promoService   *promo.Service
	redisClient    *redis.Client // optional, for SSE event publishing
	wsHub          WebSocketHub  // optional, for real-time WS broadcasts
}

const adminEventsChan = "esnack:admin:events"

func (s *Service) publishAdminEvent(ctx context.Context, eventType, orderID, restaurantName, orderStatus string) {
	if s.redisClient == nil {
		return
	}
	payload, err := json.Marshal(map[string]string{
		"type":           eventType,
		"orderId":        orderID,
		"restaurantName": restaurantName,
		"status":         orderStatus,
	})
	if err != nil {
		return
	}
	if err := s.redisClient.Publish(ctx, adminEventsChan, payload).Err(); err != nil {
		log.Printf("[order] failed to publish admin event: %v", err)
	}
}

func NewService(
	orderRepo repository.OrderRepository,
	restaurantRepo repository.RestaurantRepository,
	productRepo repository.ProductRepository,
	optionRepo repository.ProductOptionRepository,
	formulaRepo repository.FormulaRepository,
	promoService *promo.Service,
	redisClient *redis.Client,
	wsHub WebSocketHub,
) *Service {
	return &Service{
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		productRepo:    productRepo,
		optionRepo:     optionRepo,
		formulaRepo:    formulaRepo,
		promoService:   promoService,
		redisClient:    redisClient,
		wsHub:          wsHub,
	}
}

func (s *Service) CreateOrder(ctx context.Context, req *orderv1.CreateOrderRequest) (*orderv1.Order, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	if !validOrderTypes[req.OrderType] {
		return nil, status.Error(codes.InvalidArgument, "invalid order_type: must be delivery, pickup, or dine_in")
	}

	if len(req.Items) == 0 {
		return nil, status.Error(codes.InvalidArgument, "order must have at least one item")
	}

	// Validate restaurant
	restaurant, err := s.restaurantRepo.GetByID(ctx, req.RestaurantId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "restaurant not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get restaurant")
	}
	if !restaurant.IsActive {
		return nil, status.Error(codes.FailedPrecondition, "restaurant is not currently accepting orders")
	}

	// Validate order type specific requirements
	if req.OrderType == "delivery" && req.DeliveryAddress == "" {
		return nil, status.Error(codes.InvalidArgument, "delivery_address is required for delivery orders")
	}
	if req.OrderType == "dine_in" && req.TableNumber == "" {
		return nil, status.Error(codes.InvalidArgument, "table_number is required for dine-in orders")
	}
	if req.OrderType == "pickup" && !restaurant.PickupEnabled {
		return nil, status.Error(codes.FailedPrecondition, "ce restaurant ne propose pas le click & collect")
	}
	if req.PaymentType == "on_site" && req.OrderType != "pickup" {
		return nil, status.Error(codes.InvalidArgument, "le paiement sur place est uniquement disponible pour le click & collect")
	}

	// Build order items and calculate totals
	orderItems, subtotal, err := s.buildOrderItems(ctx, req.Items)
	if err != nil {
		return nil, err
	}

	// Calculate delivery fee from restaurant settings, applying free delivery threshold
	var deliveryFee float64
	if req.OrderType == "delivery" {
		deliveryFee = restaurant.DeliveryFee
		if restaurant.FreeDeliveryThreshold > 0 && subtotal >= restaurant.FreeDeliveryThreshold {
			deliveryFee = 0
		}
	}

	// Apply promo code if provided
	var discount float64
	var promoCodeID *string
	if req.PromoCode != "" && s.promoService != nil {
		promoCode, promoDiscount, err := s.promoService.ValidateAndCalculateDiscount(
			ctx, req.PromoCode, userID, req.RestaurantId, subtotal, deliveryFee,
		)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "code promo invalide: %s", err.Error())
		}
		discount = promoDiscount
		promoCodeID = &promoCode.ID
	}

	total := subtotal + deliveryFee - discount

	// Determine payment status and initial order status
	initialStatus := "pending"
	paymentStatus := "pending"
	if req.PaymentType == "on_site" {
		paymentStatus = "on_site"
		initialStatus = "confirmed"
	}

	// Create order
	order := &repository.Order{
		UserID:        userID,
		RestaurantID:  req.RestaurantId,
		OrderType:     req.OrderType,
		Status:        initialStatus,
		Subtotal:      subtotal,
		DeliveryFee:   deliveryFee,
		Discount:      discount,
		Total:         total,
		PaymentStatus: paymentStatus,
		PromoCodeID:   promoCodeID,
		Items:         orderItems,
	}

	if req.CustomerNotes != "" {
		order.CustomerNotes = req.CustomerNotes
	}

	if req.DeliveryAddress != "" {
		order.DeliveryAddress = &req.DeliveryAddress
	}
	if req.DeliveryLat != 0 {
		order.DeliveryLat = &req.DeliveryLat
	}
	if req.DeliveryLng != 0 {
		order.DeliveryLng = &req.DeliveryLng
	}
	if req.DeliveryInstructions != "" {
		order.DeliveryInstructions = &req.DeliveryInstructions
	}
	if req.TableNumber != "" {
		order.TableNumber = &req.TableNumber
	}
	if req.ScheduledPickupTime != nil {
		t := req.ScheduledPickupTime.AsTime()
		order.ScheduledPickupTime = &t
	}

	if err := s.orderRepo.Create(ctx, order); err != nil {
		return nil, status.Error(codes.Internal, "failed to create order")
	}

	// Record promo usage after successful order creation
	if promoCodeID != nil && s.promoService != nil {
		s.promoService.RecordPromoUsage(ctx, &promov1.RecordPromoUsageRequest{
			PromoCodeId:     *promoCodeID,
			UserId:          userID,
			OrderId:         order.ID,
			DiscountApplied: discount,
		})
	}

	// Notify admin dashboard via Redis SSE channel
	go s.publishAdminEvent(context.Background(), "NEW_ORDER", order.ID, restaurant.Name, order.Status)

	return s.toProto(order, restaurant.Name), nil
}

func (s *Service) buildOrderItems(ctx context.Context, inputs []*orderv1.OrderItemInput) ([]*repository.OrderItem, float64, error) {
	var items []*repository.OrderItem
	var subtotal float64

	for _, input := range inputs {
		if input.Quantity <= 0 {
			return nil, 0, status.Error(codes.InvalidArgument, "quantity must be positive")
		}

		var item *repository.OrderItem
		var itemTotal float64

		if input.ItemType == "formula" && input.FormulaId != "" {
			// ─── Formula item ───
			it, total, err := s.buildFormulaItem(ctx, input)
			if err != nil {
				return nil, 0, err
			}
			item = it
			itemTotal = total
		} else {
			// ─── Regular product item ───
			it, total, err := s.buildProductItem(ctx, input)
			if err != nil {
				return nil, 0, err
			}
			item = it
			itemTotal = total
		}

		if input.Notes != "" {
			item.Notes = &input.Notes
		}

		items = append(items, item)
		subtotal += itemTotal
	}

	return items, subtotal, nil
}

func (s *Service) buildProductItem(ctx context.Context, input *orderv1.OrderItemInput) (*repository.OrderItem, float64, error) {
	product, err := s.productRepo.GetByID(ctx, input.ProductId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, 0, status.Errorf(codes.NotFound, "product not found: %s", input.ProductId)
	}
	if err != nil {
		return nil, 0, status.Error(codes.Internal, "failed to get product")
	}
	if !product.IsAvailable {
		return nil, 0, status.Errorf(codes.FailedPrecondition, "product not available: %s", product.Name)
	}

	itemTotal := product.Price * float64(input.Quantity)
	itemOptions, optionsCost, err := s.resolveOptionChoices(ctx, product.ID, input.OptionChoiceIds)
	if err != nil {
		return nil, 0, err
	}
	itemTotal += optionsCost * float64(input.Quantity)

	return &repository.OrderItem{
		ProductID:   &product.ID,
		ProductName: product.Name,
		UnitPrice:   product.Price,
		Quantity:    int(input.Quantity),
		Total:       itemTotal,
		ItemType:    "product",
		Options:     itemOptions,
	}, itemTotal, nil
}

func (s *Service) buildFormulaItem(ctx context.Context, input *orderv1.OrderItemInput) (*repository.OrderItem, float64, error) {
	formula, err := s.formulaRepo.GetByID(ctx, input.FormulaId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, 0, status.Errorf(codes.NotFound, "formula not found: %s", input.FormulaId)
	}
	if err != nil {
		return nil, 0, status.Error(codes.Internal, "failed to get formula")
	}
	if !formula.IsAvailable {
		return nil, 0, status.Errorf(codes.FailedPrecondition, "formula not available: %s", formula.Name)
	}

	// Validate each formula product is still available
	for _, fp := range formula.Products {
		if fp.Product != nil && !fp.Product.IsAvailable {
			return nil, 0, status.Errorf(codes.FailedPrecondition, "product in formula not available: %s", fp.Product.Name)
		}
	}

	// Build formula product snapshots with per-product option selections
	var formulaProducts []*repository.OrderFormulaProduct
	var totalOptionsCost float64

	for _, sel := range input.FormulaSelections {
		// Find the matching formula product
		var matchedProduct *repository.Product
		var position int
		for _, fp := range formula.Products {
			if fp.ProductID == sel.ProductId {
				matchedProduct = fp.Product
				position = fp.Position
				break
			}
		}
		if matchedProduct == nil {
			return nil, 0, status.Errorf(codes.InvalidArgument, "product %s is not part of this formula", sel.ProductId)
		}

		// Resolve option choices for this formula product
		var fpOptions []*repository.OrderFormulaProductOption
		for _, choiceID := range sel.OptionChoiceIds {
			found := false
			productOptions, _ := s.optionRepo.ListByProduct(ctx, matchedProduct.ID)
			for _, opt := range productOptions {
				for _, choice := range opt.Choices {
					if choice.ID == choiceID {
						fpOptions = append(fpOptions, &repository.OrderFormulaProductOption{
							OptionChoiceID: &choice.ID,
							OptionName:     opt.Name,
							ChoiceName:     choice.Name,
							PriceModifier:  choice.PriceModifier,
						})
						totalOptionsCost += choice.PriceModifier
						found = true
						break
					}
				}
				if found {
					break
				}
			}
			if !found {
				return nil, 0, status.Errorf(codes.InvalidArgument, "invalid option choice: %s", choiceID)
			}
		}

		formulaProducts = append(formulaProducts, &repository.OrderFormulaProduct{
			ProductID:   &matchedProduct.ID,
			ProductName: matchedProduct.Name,
			Position:    position,
			Options:     fpOptions,
		})
	}

	itemTotal := (formula.BasePrice + totalOptionsCost) * float64(input.Quantity)

	return &repository.OrderItem{
		ProductName:     formula.Name,
		UnitPrice:       formula.BasePrice,
		Quantity:        int(input.Quantity),
		Total:           itemTotal,
		ItemType:        "formula",
		FormulaID:       &formula.ID,
		FormulaName:     formula.Name,
		FormulaProducts: formulaProducts,
	}, itemTotal, nil
}

// resolveOptionChoices validates and resolves option choice IDs for a product.
func (s *Service) resolveOptionChoices(ctx context.Context, productID string, choiceIDs []string) ([]*repository.OrderItemOption, float64, error) {
	var options []*repository.OrderItemOption
	var totalCost float64

	productOptions, _ := s.optionRepo.ListByProduct(ctx, productID)

	// Track selections per option for max_selections validation
	selectionsPerOption := map[string]int{}

	for _, choiceID := range choiceIDs {
		found := false
		for _, opt := range productOptions {
			for _, choice := range opt.Choices {
				if choice.ID == choiceID {
					selectionsPerOption[opt.ID]++
					choiceID := choice.ID
					options = append(options, &repository.OrderItemOption{
						OptionChoiceID: &choiceID,
						OptionName:     opt.Name,
						ChoiceName:     choice.Name,
						PriceModifier:  choice.PriceModifier,
					})
					totalCost += choice.PriceModifier
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if !found {
			return nil, 0, status.Errorf(codes.InvalidArgument, "invalid option choice: %s", choiceID)
		}
	}

	// Enforce max_selections
	for _, opt := range productOptions {
		if opt.MaxSelections > 0 && selectionsPerOption[opt.ID] > opt.MaxSelections {
			return nil, 0, status.Errorf(codes.InvalidArgument, "maximum %d choix pour %s", opt.MaxSelections, opt.Name)
		}
	}

	return options, totalCost, nil
}

func (s *Service) GetOrder(ctx context.Context, req *orderv1.GetOrderRequest) (*orderv1.Order, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	// Check authorization: user can only see their own orders unless admin
	if order.UserID != userID && !s.isAdmin(ctx) {
		return nil, status.Error(codes.PermissionDenied, "access denied")
	}

	restaurant, _ := s.restaurantRepo.GetByID(ctx, order.RestaurantID)
	restaurantName := ""
	if restaurant != nil {
		restaurantName = restaurant.Name
	}

	return s.toProto(order, restaurantName), nil
}

func (s *Service) ListMyOrders(ctx context.Context, req *orderv1.ListMyOrdersRequest) (*orderv1.ListOrdersResponse, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	page := int(req.Page)
	pageSize := int(req.PageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}

	orders, total, err := s.orderRepo.ListByUser(ctx, userID, page, pageSize)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list orders")
	}

	protoOrders := make([]*orderv1.Order, len(orders))
	for i, o := range orders {
		restaurant, _ := s.restaurantRepo.GetByID(ctx, o.RestaurantID)
		restaurantName := ""
		if restaurant != nil {
			restaurantName = restaurant.Name
		}
		protoOrders[i] = s.toProto(o, restaurantName)
	}

	return &orderv1.ListOrdersResponse{
		Orders:   protoOrders,
		Total:    int32(total),
		Page:     int32(page),
		PageSize: int32(pageSize),
	}, nil
}

func (s *Service) ListRestaurantOrders(ctx context.Context, req *orderv1.ListRestaurantOrdersRequest) (*orderv1.ListOrdersResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	page := int(req.Page)
	pageSize := int(req.PageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	orders, total, err := s.orderRepo.ListByRestaurant(ctx, req.RestaurantId, req.Status, page, pageSize)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list orders")
	}

	restaurant, _ := s.restaurantRepo.GetByID(ctx, req.RestaurantId)
	restaurantName := ""
	if restaurant != nil {
		restaurantName = restaurant.Name
	}

	protoOrders := make([]*orderv1.Order, len(orders))
	for i, o := range orders {
		protoOrders[i] = s.toProto(o, restaurantName)
	}

	return &orderv1.ListOrdersResponse{
		Orders:   protoOrders,
		Total:    int32(total),
		Page:     int32(page),
		PageSize: int32(pageSize),
	}, nil
}

func (s *Service) UpdateOrderStatus(ctx context.Context, req *orderv1.UpdateOrderStatusRequest) (*orderv1.Order, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if !validStatuses[req.Status] {
		return nil, status.Error(codes.InvalidArgument, "invalid status")
	}

	// Validate status transition
	order, err := s.orderRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}
	allowed, ok := validTransitions[order.Status]
	if !ok || !allowed[req.Status] {
		return nil, status.Errorf(codes.FailedPrecondition, "transition %s → %s not allowed", order.Status, req.Status)
	}

	adminID, _ := s.getUserID(ctx)
	var notes *string
	if req.Notes != "" {
		notes = &req.Notes
	}

	if err := s.orderRepo.UpdateStatus(ctx, req.Id, req.Status, &adminID, notes); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "order not found")
		}
		return nil, status.Error(codes.Internal, "failed to update order status")
	}

	order, _ = s.orderRepo.GetByID(ctx, req.Id)
	restaurant, _ := s.restaurantRepo.GetByID(ctx, order.RestaurantID)
	restaurantName := ""
	if restaurant != nil {
		restaurantName = restaurant.Name
	}

	// Notify admin dashboard of status change
	go s.publishAdminEvent(context.Background(), "ORDER_STATUS", order.ID, restaurantName, order.Status)

	// Broadcast real-time update to tracking WebSocket clients
	if s.wsHub != nil {
		go s.wsHub.BroadcastOrderStatus(order.ID, order.Status)
	}

	return s.toProto(order, restaurantName), nil
}

func (s *Service) CancelOrder(ctx context.Context, req *orderv1.CancelOrderRequest) (*orderv1.Order, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	// Check authorization
	if order.UserID != userID && !s.isAdmin(ctx) {
		return nil, status.Error(codes.PermissionDenied, "access denied")
	}

	// Check if order can be cancelled
	if order.Status != "pending" && order.Status != "confirmed" {
		return nil, status.Error(codes.FailedPrecondition, "order cannot be cancelled in current status")
	}

	notes := "Cancelled by user"
	if req.Reason != "" {
		notes = req.Reason
	}

	if err := s.orderRepo.UpdateStatus(ctx, req.Id, "cancelled", &userID, &notes); err != nil {
		return nil, status.Error(codes.Internal, "failed to cancel order")
	}

	order, _ = s.orderRepo.GetByID(ctx, req.Id)
	restaurant, _ := s.restaurantRepo.GetByID(ctx, order.RestaurantID)
	restaurantName := ""
	if restaurant != nil {
		restaurantName = restaurant.Name
	}

	// Broadcast real-time cancellation to tracking WebSocket clients
	if s.wsHub != nil {
		go s.wsHub.BroadcastOrderStatus(order.ID, "cancelled")
	}

	return s.toProto(order, restaurantName), nil
}

func (s *Service) UpdateOrderPrepTime(ctx context.Context, req *orderv1.UpdateOrderPrepTimeRequest) (*orderv1.Order, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	if req.Minutes <= 0 || req.Minutes > 300 {
		return nil, status.Error(codes.InvalidArgument, "minutes must be between 1 and 300")
	}

	if err := s.orderRepo.UpdatePrepTime(ctx, req.Id, req.Minutes); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "order not found")
		}
		return nil, status.Error(codes.Internal, "failed to update prep time")
	}

	order, err := s.orderRepo.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}
	restaurant, _ := s.restaurantRepo.GetByID(ctx, order.RestaurantID)
	restaurantName := ""
	if restaurant != nil {
		restaurantName = restaurant.Name
	}
	return s.toProto(order, restaurantName), nil
}

func (s *Service) getUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		return "", status.Error(codes.Unauthenticated, "authentication required")
	}
	return userID, nil
}

func (s *Service) isAdmin(ctx context.Context) bool {
	role, ok := ctx.Value(auth.UserRoleKey).(string)
	return ok && role == "admin"
}

func (s *Service) requireAdmin(ctx context.Context) error {
	if !s.isAdmin(ctx) {
		return status.Error(codes.PermissionDenied, "admin access required")
	}
	return nil
}

func (s *Service) toProto(o *repository.Order, restaurantName string) *orderv1.Order {
	proto := &orderv1.Order{
		Id:             o.ID,
		OrderNumber:    o.OrderNumber,
		UserId:         o.UserID,
		RestaurantId:   o.RestaurantID,
		RestaurantName: restaurantName,
		OrderType:      o.OrderType,
		Status:         o.Status,
		Subtotal:       o.Subtotal,
		DeliveryFee:    o.DeliveryFee,
		Discount:       o.Discount,
		Total:          o.Total,
		PaymentStatus:  o.PaymentStatus,
		CreatedAt:      timestamppb.New(o.CreatedAt),
		UpdatedAt:      timestamppb.New(o.UpdatedAt),
	}

	if o.DeliveryAddress != nil {
		proto.DeliveryAddress = *o.DeliveryAddress
	}
	if o.DeliveryLat != nil {
		proto.DeliveryLat = *o.DeliveryLat
	}
	if o.DeliveryLng != nil {
		proto.DeliveryLng = *o.DeliveryLng
	}
	if o.DeliveryInstructions != nil {
		proto.DeliveryInstructions = *o.DeliveryInstructions
	}
	if o.TableNumber != nil {
		proto.TableNumber = *o.TableNumber
	}
	if o.ScheduledPickupTime != nil {
		proto.ScheduledPickupTime = timestamppb.New(*o.ScheduledPickupTime)
	}
	if o.PaymentIntentID != nil {
		proto.PaymentIntentId = *o.PaymentIntentID
	}
	if o.CompletedAt != nil {
		proto.CompletedAt = timestamppb.New(*o.CompletedAt)
	}

	// Customer notes
	proto.CustomerNotes = o.CustomerNotes

	// Estimated prep time
	if o.EstimatedPrepMinutes != nil {
		proto.EstimatedPrepMinutes = *o.EstimatedPrepMinutes
	}

	// Customer info (from JOIN)
	proto.CustomerName = o.CustomerName
	proto.CustomerEmail = o.CustomerEmail
	proto.CustomerPhone = o.CustomerPhone

	// Driver info (from JOIN)
	if o.DriverID != nil {
		proto.DriverId = *o.DriverID
	}
	proto.DriverName = o.DriverName
	proto.DriverPhone = o.DriverPhone

	// Items
	if o.Items != nil {
		proto.Items = make([]*orderv1.OrderItem, len(o.Items))
		for i, item := range o.Items {
			protoItem := &orderv1.OrderItem{
				Id:          item.ID,
				ProductName: item.ProductName,
				UnitPrice:   item.UnitPrice,
				Quantity:    int32(item.Quantity),
				Total:       item.Total,
				ItemType:    item.ItemType,
				FormulaName: item.FormulaName,
			}
			if item.ProductID != nil {
				protoItem.ProductId = *item.ProductID
			}
			if item.FormulaID != nil {
				protoItem.FormulaId = *item.FormulaID
			}
			if item.Notes != nil {
				protoItem.Notes = *item.Notes
			}
			if item.Options != nil {
				protoItem.Options = make([]*orderv1.OrderItemOption, len(item.Options))
				for j, opt := range item.Options {
					protoItem.Options[j] = &orderv1.OrderItemOption{
						Id:            opt.ID,
						OptionName:    opt.OptionName,
						ChoiceName:    opt.ChoiceName,
						PriceModifier: opt.PriceModifier,
					}
				}
			}
			// Formula products snapshot
			if item.FormulaProducts != nil {
				protoItem.FormulaProducts = make([]*orderv1.OrderFormulaProduct, len(item.FormulaProducts))
				for j, fp := range item.FormulaProducts {
					protoFP := &orderv1.OrderFormulaProduct{
						Id:          fp.ID,
						ProductName: fp.ProductName,
						Position:    int32(fp.Position),
					}
					if fp.Options != nil {
						protoFP.Options = make([]*orderv1.OrderItemOption, len(fp.Options))
						for k, fpOpt := range fp.Options {
							protoFP.Options[k] = &orderv1.OrderItemOption{
								Id:            fpOpt.ID,
								OptionName:    fpOpt.OptionName,
								ChoiceName:    fpOpt.ChoiceName,
								PriceModifier: fpOpt.PriceModifier,
							}
						}
					}
					protoItem.FormulaProducts[j] = protoFP
				}
			}
			proto.Items[i] = protoItem
		}
	}

	// Status history
	if o.StatusHistory != nil {
		proto.StatusHistory = make([]*orderv1.OrderStatusChange, len(o.StatusHistory))
		for i, h := range o.StatusHistory {
			change := &orderv1.OrderStatusChange{
				Id:        h.ID,
				Status:    h.Status,
				CreatedAt: timestamppb.New(h.CreatedAt),
			}
			if h.ChangedBy != nil {
				change.ChangedBy = *h.ChangedBy
			}
			if h.Notes != nil {
				change.Notes = *h.Notes
			}
			proto.StatusHistory[i] = change
		}
	}

	return proto
}
